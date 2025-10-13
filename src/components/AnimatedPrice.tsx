import { useEffect, useRef, useState } from 'react';
import { Box } from '@chakra-ui/react';
import { formatCurrency } from '../utils';

interface AnimatedPriceProps {
  price: number;
  color: string;
  colorMode: 'light' | 'dark';
  filter?: string;
  opacity?: number;
  transition?: string;
  display?: string;
  showTestButton?: boolean;
}

interface DigitAnimation {
  from: string;
  to: string;
  isAnimating: boolean;
}

export const AnimatedPrice = ({
  price,
  color,
  colorMode,
  filter,
  opacity,
  transition,
  display,
}: AnimatedPriceProps) => {
  const displayPrice = price;
  
  const [formattedPrice, setFormattedPrice] = useState(formatCurrency(displayPrice));
  const [digitAnimations, setDigitAnimations] = useState<Map<number, DigitAnimation>>(new Map());
  const [animationStarted, setAnimationStarted] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false);
  const prevPriceRef = useRef(formatCurrency(displayPrice));
  const isFirstRender = useRef(true);


  useEffect(() => {
    const newFormatted = formatCurrency(displayPrice);
    const oldFormatted = prevPriceRef.current;

    // Skip animation on first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setFormattedPrice(newFormatted);
      prevPriceRef.current = newFormatted;
      return;
    }

    // Find which character indices have changed, comparing from right-to-left to handle length changes
    const  newAnimations = new Map<number, DigitAnimation>();
    const oldDigits = oldFormatted.split('').filter(c => /\d/.test(c));
    
    // Map new digits to their original character index
    const newDigitsWithIndices = newFormatted
      .split('')
      .map((c, i) => ({ char: c, index: i }))
      .filter(item => /\d/.test(item.char));

    let oldDigitIndex = oldDigits.length - 1;
    let newDigitIndex = newDigitsWithIndices.length - 1;

    while (newDigitIndex >= 0) {
      const oldDigit = oldDigits[oldDigitIndex] || '0'; // Default to '0' if old price had fewer digits
      const newDigitItem = newDigitsWithIndices[newDigitIndex];

    if (oldDigit !== newDigitItem.char) {
        newAnimations.set(newDigitItem.index, {
          from: oldDigit,
          to: newDigitItem.char,
          isAnimating: true
        });
    }

      oldDigitIndex--;
      newDigitIndex--;
    }


    if (newAnimations.size > 0) {
      
      // Start with animations not started (position 0)
      setAnimationStarted(false);
      setAnimationComplete(false);
      setDigitAnimations(newAnimations);
      
      // Update price immediately
      setFormattedPrice(newFormatted);
      
      // Use requestAnimationFrame to ensure browser paints the start state first
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimationStarted(true);
        });
      });
      
      // After animation completes, snap to final position
      const completeTimer = setTimeout(() => {
        setAnimationComplete(true);
      }, 1600);
      
      // Then clear animations and update the price reference for the next cycle
      const clearTimer = setTimeout(() => {
        setDigitAnimations(new Map());
        setAnimationStarted(false);
        setAnimationComplete(false);
        prevPriceRef.current = newFormatted; // Update ref only after animation is fully done
      }, 1650);

      return () => {
        clearTimeout(completeTimer);
        clearTimeout(clearTimer);
      };
    } else {
      setFormattedPrice(newFormatted);
      prevPriceRef.current = newFormatted;
    }
  }, [displayPrice]);

  const chars = formattedPrice.split('');

  return (
    <>
      <Box  
        color={color}
        opacity={opacity}
        transition={transition}
        filter={filter}
        display={display}
        style={{ whiteSpace: 'pre', display: 'inline-flex', alignItems: 'center' }}
      >
      <style>
        {`
          .digit-wheel-container {
            display: inline-block;
            overflow: hidden;
            height: 1em;
            line-height: 1em;
            vertical-align: baseline;
            position: relative;
          }
          
          .digit-wheel {
            display: flex;
            flex-direction: column;
            position: relative;
            will-change: transform;
          }
          
          .digit-wheel-item {
            height: 1em;
            line-height: 1em;
            flex-shrink: 0;
            display: block;
          }
          
          @keyframes digit-glow {
            0%, 100% {
              text-shadow: 0 0 0px currentColor;
            }
            50% {
              text-shadow: 0 0 ${colorMode === 'dark' ? '8px' : '4px'} currentColor;
            }
          }
        `}
      </style>
      {chars.map((char, index) => {
        const animation = digitAnimations.get(index);
        const isDigit = /\d/.test(char);
        
        if (!isDigit) {
          return (
            <span key={`${index}-${char}`} style={{ display: 'inline-block' }}>
              {char}
            </span>
          );
        }
        
        const currentDigit = parseInt(char);
        
        // Calculate offsets in em units (negative values move the wheel up to show the digit)
        // Each digit is 1em tall, so digit N is at position -N em
        let currentOffset = -currentDigit;
        let hasTransition = false;
        
        if (animation?.isAnimating) {
          const fromDigit = parseInt(animation.from);
          const toDigit = parseInt(animation.to);
          
          // Calculate distance - always go forward (upward motion)
          let distance = toDigit - fromDigit;
          const needsWrap = distance < 0;
          if (needsWrap) {
            distance += 10;
          }
          
          if (!animationStarted) {
            // Before animation starts: show the "from" digit
            currentOffset = -fromDigit;
          } else if (animationComplete) {
            // After animation completes: snap to final position (first occurrence)
            currentOffset = -toDigit;
          } else {
            // During animation: move to target (use second occurrence if wrapping)
            const targetPosition = needsWrap ? toDigit + 10 : toDigit;
            currentOffset = -targetPosition;
            hasTransition = true;
          }
        }
        
        return (
          <Box
            key={`${index}-${char}`}
            className="digit-wheel-container"
          >
            <Box
              className="digit-wheel"
              style={{
                transform: `translateY(${currentOffset}em)`,
                transition: hasTransition ? 'transform 1.5s ease-out 0s' : 'none'
              }}
            >
              {/* Show 0-9 twice to handle wrapping smoothly */}
              {Array.from({ length: 20 }, (_, i) => i % 10).map((digit, seqIndex) => (
                <span 
                  key={seqIndex} 
                  className="digit-wheel-item"
                  style={{
                    height: '1em',
                    lineHeight: '1em'
                  }}
                >
                  {digit}
                </span>
              ))}
            </Box>
          </Box>
        );
      })}
    </Box>
    </>
  );
};
