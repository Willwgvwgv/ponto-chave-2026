import React, { useRef, useEffect, useState } from 'react';
import { motion, useInView } from 'framer-motion';

export interface BlurTextProps {
  text?: string;
  delay?: number;
  className?: string;
  animateBy?: 'words' | 'letters';
  direction?: 'top' | 'bottom';
  threshold?: number;
  rootMargin?: string;
  animationFrom?: {
    filter?: string;
    opacity?: number;
    transform?: string;
  };
  animationTo?: Array<{
    filter?: string;
    opacity?: number;
    transform?: string;
  }>;
  easing?: (t: number) => number | string;
  onAnimationComplete?: () => void;
}

export const BlurText: React.FC<BlurTextProps> = ({
  text = '',
  delay = 200,
  className = '',
  animateBy = 'words',
  direction = 'top',
  threshold = 0.1,
  rootMargin = '-50px',
  animationFrom,
  animationTo,
  easing = 'easeOut',
  onAnimationComplete,
}) => {
  const elements = animateBy === 'words' ? text.split(' ') : text.split('');
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);
  const isInView = useInView(ref, { once: true, amount: threshold, margin: rootMargin as any });

  useEffect(() => {
    if (isInView) {
      setInView(true);
    }
  }, [isInView]);

  const defaultFrom =
    direction === 'top'
      ? { filter: 'blur(10px)', opacity: 0, transform: 'translate3d(0,-20px,0)' }
      : { filter: 'blur(10px)', opacity: 0, transform: 'translate3d(0,20px,0)' };

  const defaultTo = [
    {
      filter: 'blur(4px)',
      opacity: 0.6,
      transform: direction === 'top' ? 'translate3d(0,5px,0)' : 'translate3d(0,-5px,0)',
    },
    {
      filter: 'blur(0px)',
      opacity: 1,
      transform: 'translate3d(0,0px,0)',
    },
  ];

  const from = animationFrom || defaultFrom;
  const to = animationTo || defaultTo;

  return (
    <p ref={ref} className={`inline-flex flex-wrap ${className}`}>
      {elements.map((element, index) => (
        <motion.span
          key={index}
          initial={from}
          animate={inView ? to[to.length - 1] : from}
          transition={{
            duration: 0.6,
            delay: (index * delay) / 1000,
            ease: typeof easing === 'string' ? (easing === 'easeOut' ? [0.25, 0.1, 0.25, 1] : easing) : undefined,
          }}
          onAnimationComplete={index === elements.length - 1 ? onAnimationComplete : undefined}
          className="inline-block whitespace-pre"
        >
          {element}
          {animateBy === 'words' && index < elements.length - 1 && '\u00A0'}
        </motion.span>
      ))}
    </p>
  );
};

export default BlurText;
