import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdmin } from "../_firebaseAdmin.js";

export default async function handler(req: any, res: any) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { adminDb, adminAuthInstance } = getFirebaseAdmin();

  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Acesso não autorizado: Token não fornecido" });
  }

  const idToken = authHeader.split("Bearer ")[1];

  if (!adminAuthInstance || !adminDb) {
    return res.status(503).json({ error: "Serviço de autenticação do servidor indisponível" });
  }

  try {
    const decodedToken = await adminAuthInstance.verifyIdToken(idToken);
    const requesterUid = decodedToken.uid;

    if (!requesterUid) {
      return res.status(401).json({ error: "Acesso não autorizado: Token inválido" });
    }

    const requesterDoc = await adminDb.collection("users").doc(requesterUid).get();
    const requesterData = requesterDoc.exists ? requesterDoc.data() : null;

    const isMasterAdmin = decodedToken.email === "williangyn10@gmail.com" || requesterData?.email === "williangyn10@gmail.com";
    const isAdminRole = requesterData?.role === "admin" || requesterData?.role === "superadmin";
    const isActive = requesterData?.status === "active";

    if (!isMasterAdmin && (!isAdminRole || !isActive)) {
      return res.status(403).json({ error: "Acesso negado: Apenas administradores ativos podem redefinir senhas diretamente." });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { targetUid, newPassword } = body;

    if (!targetUid || typeof targetUid !== "string") {
      return res.status(400).json({ error: "ID do usuário de destino é obrigatório." });
    }

    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({ error: "A nova senha deve ter no mínimo 6 caracteres." });
    }

    const deletedDoc = await adminDb.collection("deleted_users").doc(targetUid).get();
    if (deletedDoc.exists) {
      return res.status(400).json({ error: "Não é possível redefinir senha de uma conta excluída." });
    }

    const targetDoc = await adminDb.collection("users").doc(targetUid).get();
    if (!targetDoc.exists) {
      return res.status(404).json({ error: "Usuário não encontrado no sistema." });
    }

    const targetData = targetDoc.data();

    if (!isMasterAdmin) {
      const requesterCompanyId = requesterData?.companyId;
      const targetCompanyId = targetData?.companyId;
      if (!requesterCompanyId || requesterCompanyId !== targetCompanyId) {
        return res.status(403).json({ error: "Acesso negado: Você só pode redefinir senhas de usuários da mesma empresa." });
      }
    }

    await adminAuthInstance.updateUser(targetUid, {
      password: newPassword,
    });

    try {
      await adminAuthInstance.revokeRefreshTokens(targetUid);
    } catch (revokeErr) {
      console.warn("Aviso: Falha ao revogar refresh tokens:", revokeErr);
    }

    try {
      await adminDb.collection("users").doc(targetUid).update({
        temporaryPassword: FieldValue.delete(),
        mustChangePassword: FieldValue.delete(),
        customPassword: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp()
      });
    } catch (cleanErr) {
      console.warn("Aviso ao limpar campos temporários no Firestore:", cleanErr);
    }

    return res.status(200).json({
      success: true,
      message: "Senha atualizada com sucesso no Firebase Authentication."
    });

  } catch (err: any) {
    console.error("Erro na redefinição direta de senha:", err);
    return res.status(500).json({
      error: `Erro ao redefinir senha: ${err?.message || "Erro interno do servidor."}`
    });
  }
}
