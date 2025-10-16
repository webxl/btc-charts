import { formatCurrency, formatCurrencyWithCents } from '../../utils.ts';
import { PriceBandTypes, priceBandLabels } from '../../calc.ts';
import { SliceTooltipProps } from '@nivo/line';
import { useColorMode } from '@chakra-ui/system';
import { Box } from '@chakra-ui/react';
import dayjs from 'dayjs';
import { genesis, sigmaBandColor } from '../../const.ts';
import React, { ReactElement, useEffect, useState } from 'react';
import { ChartSettings } from '../../charts/ChartControls.tsx';

type Datum = { x: number; y: number | null };

type _SliceTooltipProps = { chartSettings: ChartSettings } & SliceTooltipProps<{
  id: string;
  color: string;
  data: Datum[];
}>;

export const SliceTooltip = React.forwardRef<HTMLDivElement, _SliceTooltipProps>(
  ({ slice, chartSettings }, ref) => {
    const xFormatted = slice.points[0].data.xFormatted;
    const seenLabels = new Set<PriceBandTypes>();
    const allYValuesUnder1000 = slice.points.every(p => p.data.y !== null && p.data.y < 1000);
    const { colorMode } = useColorMode();

    const [shouldFlip, setShouldFlip] = useState(false);
    const [tooltipElement, setTooltipElement] = useState<HTMLDivElement | null>(null);
    const [tooltipOffset, setTooltipOffset] = useState(220);
    const [tooltipYOffset, setTooltipYOffset] = useState(0);
    // edge detection
    useEffect(() => {
      if (!tooltipElement) return;

      const isMobile = window.innerWidth < 768;
      const offset = isMobile ? 180 : 220;
      setTooltipOffset(offset);

      if (isMobile) {
        setTooltipYOffset(100);
      }

      const currentTransform = tooltipElement.style.transform;
      tooltipElement.style.transform = 'none';

      const tooltipRect = tooltipElement.getBoundingClientRect();
      const tooltipWidth = tooltipRect.width;

      tooltipElement.style.transform = currentTransform;

      let chartContainer =
        tooltipElement.parentElement?.parentElement?.parentElement?.parentElement;

      if (chartContainer) {
        const chartRect = chartContainer.getBoundingClientRect();
        const rightMargin = 20;

        // Calculate where tooltip will be AFTER offset is applied
        const tooltipRightEdge = tooltipRect.left + offset + tooltipWidth;
        const tooltipLeftEdge = tooltipRect.left;

        const wouldOverflowRight = tooltipRightEdge > chartRect.right - rightMargin;
        const wouldOverflowLeft = tooltipLeftEdge < chartRect.left + rightMargin;

        setShouldFlip(wouldOverflowRight && !wouldOverflowLeft);
      }
    }, [tooltipElement, slice.points]);

    return (
      <Box
        ref={node => {
          setTooltipElement(node);
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
          }
        }}
        background={colorMode === 'dark' ? '#1A202CCC' : 'whiteAlpha.900'}
        padding="9px 12px"
        border="1px solid"
        borderColor={colorMode === 'dark' ? 'white.alpha.300' : 'black.alpha.300'}
        borderRadius="md"
        fontSize="10pt"
        transition="opacity 0.3s ease-in-out"
        sx={{
          transform: `translateY(${tooltipYOffset}px) translateX(${shouldFlip ? '0' : tooltipOffset}px)`
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '10px'
          }}
        >
          {chartSettings.useXLog ? 'Day ' : ''} {xFormatted}
          {chartSettings.useXLog && (
            <span
              style={{
                display: 'flex'
              }}
            >
              {`${dayjs(genesis).add(Number(xFormatted), 'day').format('MMM D, YYYY')}`}
            </span>
          )}
        </div>
        {Array.prototype.sort
          .call(slice.points, (p1: any, p2: any) => (p1.data.y < p2.data.y ? 1 : -1))
          .filter((p: any) => p.data.xFormatted === xFormatted)
          .map((point: any): ReactElement | undefined => {
            const price = point.data.y as number;
            if (seenLabels.has(point.seriesId as PriceBandTypes)) {
              // overlapping point fix
              return undefined;
            }
            seenLabels.add(point.seriesId as PriceBandTypes);
            return (
              <div
                key={point.id}
                style={{
                  minWidth: 160,
                  whiteSpace: 'nowrap',
                  color: colorMode === 'dark' ? '#ccc' : '#333',
                  display: 'flex',
                  gap: '2rem'
                }}
              >
                <div
                  key={point.id}
                  style={{
                    width: '50%',
                    display: 'flex',
                    color: colorMode === 'dark' ? '#ccc' : '#333'
                  }}
                >
                  {priceBandLabels[point.seriesId as PriceBandTypes]}:{' '}
                </div>

                <div
                  style={{
                    color:
                      (point.seriesId as PriceBandTypes).indexOf('igma') !== -1
                        ? sigmaBandColor
                        : point.seriesColor,
                    flexGrow: 1,
                    justifyContent: 'flex-end',
                    textAlign: 'right',
                    display: 'flex'
                  }}
                >
                  {' '}
                  {allYValuesUnder1000 ? formatCurrencyWithCents(price) : formatCurrency(price)}
                </div>
              </div>
            );
          })}{' '}
      </Box>
    );
  }
);
