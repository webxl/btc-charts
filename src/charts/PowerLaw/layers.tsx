import { area } from 'd3-shape';
import React, { Fragment, useRef, useState, useEffect } from 'react';
import { type ChartSettings } from '../ChartControls.tsx';
import { Defs, useAnimatedPath } from '@nivo/core';
import { animated, to } from '@react-spring/web';
import { convertToRomanNumeral } from '../../utils.ts';
import { PriceBandTypes } from '../../calc.ts';
import { bitcoinHalvingEpochs } from '../../const.ts';
import { epochColors } from '../../theme.ts';

const AreaPath = ({
  areaBlendMode,
  areaOpacity,
  fill,
  path
}: {
  areaBlendMode: string;
  areaOpacity: number;
  fill: string;
  path: string;
}) => {
  const [isFirstRender, setIsFirstRender] = React.useState(true);

  React.useEffect(() => {
    // Disable animation on first render to prevent path interpolation issues
    const timer = setTimeout(() => setIsFirstRender(false), 100);
    return () => clearTimeout(timer);
  }, []);

  const animatedPath = useAnimatedPath(path);

  // On first render, use the path directly without animation
  if (isFirstRender) {
    return (
      <path
        d={path}
        fill={fill}
        fillOpacity={areaOpacity}
        strokeWidth={0}
        style={{
          mixBlendMode: areaBlendMode as React.CSSProperties['mixBlendMode']
        }}
      />
    );
  }

  return (
    <animated.path
      d={to(animatedPath, p => p || '')}
      fill={fill}
      fillOpacity={areaOpacity}
      strokeWidth={0}
      style={{
        mixBlendMode: areaBlendMode as React.CSSProperties['mixBlendMode']
      }}
    />
  );
};

const CustomAnimatedLine = React.memo(({ series, path }: { series: any; path: string }) => {
  const [isFirstRender, setIsFirstRender] = React.useState(true);
  const pathRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = React.useState<number | null>(null);
  const [shouldAnimate, setShouldAnimate] = React.useState(true);

  // safari will animate segments of the plot no matter what
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  React.useEffect(() => {
    if (isSafari) {
      const timer = setTimeout(() => {
        setShouldAnimate(false);
        setIsFirstRender(false);
      }, 1500);
      return () => clearTimeout(timer);
    }

    if (pathRef.current && pathLength === null) {
      const length = pathRef.current.getTotalLength();
      setPathLength(length);

      const timer = setTimeout(() => {
        setShouldAnimate(false);
        setIsFirstRender(false);
      }, 1600);

      return () => clearTimeout(timer);
    }
  }, [pathLength, path, isSafari]);

  const animatedPath = useAnimatedPath(path);

  if (isSafari && shouldAnimate) {
    // just fade in for safari
    return (
      <path
        d={path}
        fill="none"
        stroke={series.color}
        strokeWidth={series.id === 'price' || series.id === 'powerLaw' ? 2 : 0}
        data-id={series.id}
        data-type="line"
        filter={series.id === 'price' ? 'url(#line-shadow)' : undefined}
        style={{
          pointerEvents: 'none',
          opacity: 0,
          animation: 'fadeIn 1.5s ease-in-out forwards'
        }}
      />
    );
  }

  if (shouldAnimate && pathLength) {
    return (
      <path
        ref={pathRef}
        d={path}
        fill="none"
        stroke={series.color}
        strokeWidth={series.id === 'price' || series.id === 'powerLaw' ? 2 : 0}
        data-id={series.id}
        data-type="line"
        filter={series.id === 'price' ? 'url(#line-shadow)' : undefined}
        style={{
          pointerEvents: 'none',
          strokeDasharray: String(Math.floor(pathLength) * 10),
          strokeDashoffset: String(Math.floor(pathLength) * 10),
          animation: 'dash 1.5s ease-in-out forwards'
        }}
      />
    );
  }

  if (isFirstRender && !isSafari) {
    return (
      <path
        ref={pathRef}
        d={path}
        fill="none"
        stroke={series.color}
        strokeWidth={series.id === 'price' || series.id === 'powerLaw' ? 2 : 0}
        data-id={series.id}
        data-type="line"
        style={{ pointerEvents: 'none', opacity: 0 }}
      />
    );
  }

  return (
    <animated.path
      d={to(animatedPath, p => p || '')}
      fill="none"
      stroke={series.color}
      strokeWidth={series.id === 'price' || series.id === 'powerLaw' ? 2 : 0}
      data-id={series.id}
      data-type="line"
      filter={series.id === 'price' ? 'url(#line-shadow)' : undefined}
      style={{ pointerEvents: 'none' }}
    />
  );
});

export const useLayers = ({
  chartSettings,
  startDate,
  endDate,
  colorMode,
  initialDaysSinceGenesis,
  getDaysFromStartDate,
  isLoading,
  latestPrice,
  triggerBeacon
}: {
  chartSettings: ChartSettings;
  startDate: Date;
  endDate: Date;
  colorMode: 'dark' | 'light';
  initialDaysSinceGenesis: number;
  getDaysFromStartDate: (date: Date) => number;
  isLoading: boolean;
  latestPrice?: number;
  triggerBeacon?: number;
}): {
  AreaLayer: React.FC<{ series: any; xScale: any; yScale: any; innerHeight: number }>;
  CustomLineLayer: React.FC<{ series: any; lineGenerator: any; xScale: any; yScale: any }>;
  EpochLayer: React.FC<{ xScale: any; innerHeight: number }>;
  BeaconLayer: React.FC<{ series: any; xScale: any; yScale: any }>;
  LoadingLayer: React.FC<{ innerWidth: number; innerHeight: number }>;
} => {
  //   const genesis = useMemo(() => new Date(2009, 0, 3), []);

  const AreaLayer = ({ series, xScale, yScale, innerHeight }: any) => {
    const getArea = (lowerBound: readonly any[], upperBound: readonly any[]) => {
      // Ensure both bounds have the same length and valid data
      if (!lowerBound || !upperBound || lowerBound.length === 0 || upperBound.length === 0) {
        return null;
      }

      const minLength = Math.min(lowerBound.length, upperBound.length);
      const trimmedUpper = upperBound.slice(0, minLength);
      const trimmedLower = lowerBound.slice(0, minLength);

      return area<any>()
        .defined((d: any, i: number) => {
          // Only draw area if both bounds have valid data at this index
          return (
            i < trimmedLower.length &&
            d.data.y !== null &&
            trimmedLower[i].data.y !== null &&
            (!chartSettings.useYLog || (d.data.y > 0 && trimmedLower[i].data.y > 0))
          );
        })
        .x((d: any) => {
          const xVal = Number(d.data.x);
          return typeof xScale === 'function' ? xScale(xVal) : 0;
        })
        .y0((d: any) => {
          const y = Number(d.data.y);
          if (y === null || (chartSettings.useYLog && y <= 0)) return innerHeight;
          return typeof yScale === 'function' ? yScale(y) : 0;
        })
        .y1((_d: any, i: number) => {
          if (i >= trimmedLower.length) return innerHeight;
          const y = Number(trimmedLower[i].data.y);
          if (y === null || (chartSettings.useYLog && y <= 0)) return innerHeight;
          return typeof yScale === 'function' ? yScale(y) : 0;
        })(trimmedUpper);
    };

    const lowerOuterBound =
      (series as readonly any[]).find(s => s.id === PriceBandTypes.negTwoSigma)?.data ?? [];
    const upperOuterBound =
      (series as readonly any[]).find(s => s.id === PriceBandTypes.posTwoSigma)?.data ?? [];
    const lowerInnerBound =
      (series as readonly any[]).find(s => s.id === PriceBandTypes.negOneSigma)?.data ?? [];
    const upperInnerBound =
      (series as readonly any[]).find(s => s.id === PriceBandTypes.posOneSigma)?.data ?? [];

    const outerBand = chartSettings.showOuterBand
      ? getArea(lowerOuterBound, upperOuterBound)
      : null;
    const innerBand = chartSettings.showInnerBand
      ? getArea(lowerInnerBound, upperInnerBound)
      : null;

    return (
      <>
        <defs>
          <filter id="line-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow
              dx="0"
              dy="1"
              stdDeviation="3"
              floodOpacity={colorMode === 'dark' ? 0.5 : 0.9}
              floodColor={colorMode === 'dark' ? 'white' : '#66e264'}
            />
          </filter>
        </defs>

        {chartSettings.showOuterBand && outerBand && (
          <AreaPath
            areaBlendMode={'normal'}
            areaOpacity={0.8}
            fill={colorMode === 'light' ? '#c5e7fd' : '#1e3d4d'}
            path={outerBand}
          />
        )}
        {chartSettings.showInnerBand && innerBand && (
          <AreaPath
            areaBlendMode={'normal'}
            areaOpacity={0.8}
            fill={colorMode === 'light' ? '#9ed7fb' : '#275566'}
            path={innerBand}
          />
        )}
      </>
    );
  };

  // Custom line layer that adds data-id attributes for CSS targeting
  const CustomLineLayer = ({ series, lineGenerator, xScale, yScale }: any) => {
    return (
      <g>
        {series.map((serie: any) => {
          const validPoints = serie.data
            .filter((d: any) => {
              const yVal = d.data.y;
              if (yVal === null || yVal === undefined || isNaN(yVal)) return false;
              if (chartSettings.useYLog && yVal <= 0) return false;
              return true;
            })
            .map((d: any) => ({
              x: xScale(d.data.x),
              y: yScale(d.data.y)
            }));
          if (validPoints.length === 0) return null;

          const path = lineGenerator(validPoints);
          return <CustomAnimatedLine key={serie.id} series={serie} path={path} />;
        })}
      </g>
    );
  };

  const EpochLayer = ({ xScale, innerHeight }: any) => {
    const prevShowHalvingEpochs = useRef(chartSettings.showHalvingEpochs);
    const [isAnimatingOut, setIsAnimatingOut] = useState(false);

    // Calculate resolution-based offset for epoch boundaries
    // This ensures epochs appear seamless across different scales
    const getEpochBoundaryOffset = () => {
      const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const maxPoints = 800; // Should match the value in PowerLawChart

      // Calculate the typical spacing between data points in days
      const avgSpacingDays = days / maxPoints;

      if (chartSettings.useXLog) {
        // For log scale (x is in days), we need overlap because we can't draw on half-days using layers
        // Return 0 so epochs share the boundary day (overlap by 1 day)
        return 0;
      } else {
        // For linear scale (x is in milliseconds), use precise millisecond offset
        // to prevent visual gaps while avoiding overlap
        const offsetDays = Math.max(0.1, avgSpacingDays);
        return offsetDays * 24 * 60 * 60 * 1000; // Convert to milliseconds
      }
    };

    const epochBoundaryOffset = getEpochBoundaryOffset();

    useEffect(() => {
      if (prevShowHalvingEpochs.current && !chartSettings.showHalvingEpochs) {
        setIsAnimatingOut(true);
        const timeout = setTimeout(() => {
          setIsAnimatingOut(false);
        }, 500); // Match animation duration
        return () => clearTimeout(timeout);
      }
      prevShowHalvingEpochs.current = chartSettings.showHalvingEpochs;
    }, [chartSettings.showHalvingEpochs]);

    if (!chartSettings.showHalvingEpochs && !isAnimatingOut) return null;

    const areaGenerator = area()
      .x((d: any) => xScale(d.data.x))
      .y0(() => innerHeight)
      .y1(() => 0);

    const epochRanges = bitcoinHalvingEpochs.map((epoch: Date, index: number) => {
      const start = chartSettings.useXLog
        ? initialDaysSinceGenesis + getDaysFromStartDate(epoch)
        : epoch.getTime();
      const nextEpoch = bitcoinHalvingEpochs[index + 1];
      const end = nextEpoch
        ? chartSettings.useXLog
          ? initialDaysSinceGenesis + getDaysFromStartDate(nextEpoch)
          : nextEpoch.getTime()
        : undefined;
      return {
        start,
        end,
        color: epochColors[colorMode][index % epochColors[colorMode].length]
      };
    });

    return (
      <>
        <Defs
          defs={epochColors[colorMode].map((color: string, index: number) => ({
            id: `pattern-${index}`,
            type: 'patternDots',
            background: 'transparent',
            color: color,
            size: 1,
            padding: 4,
            stagger: false
          }))}
        />
        <g style={{ pointerEvents: 'none' }}>
          {epochRanges.map(
            (range: { start: number; end: number | undefined; color: string }, index: number) => {
              if (!range.end) return null;

              if (
                (chartSettings.useXLog && range.end < initialDaysSinceGenesis) ||
                (!chartSettings.useXLog && range.end < startDate.getTime()) ||
                (chartSettings.useXLog &&
                  range.start > initialDaysSinceGenesis + getDaysFromStartDate(endDate)) ||
                (!chartSettings.useXLog && range.start > endDate.getTime())
              )
                return null;

              const nextEpoch = epochRanges[index + 1];
              const adjustedEpochEnd = chartSettings.useXLog
                ? initialDaysSinceGenesis + getDaysFromStartDate(endDate)
                : endDate.getTime();
              const epochData = [
                {
                  data: {
                    x: chartSettings.useXLog
                      ? index === 0
                        ? initialDaysSinceGenesis
                        : Math.max(range.start, initialDaysSinceGenesis)
                      : index === 0
                        ? startDate.getTime()
                        : Math.max(range.start - epochBoundaryOffset, startDate.getTime()),
                    y: 0
                  }
                },
                {
                  data: {
                    x: !!nextEpoch
                      ? Math.min(nextEpoch.start - epochBoundaryOffset, adjustedEpochEnd)
                      : range.start,
                    y: 0
                  }
                }
              ];

              const fiveDays = 5 * 24 * 60 * 60 * 1000;
              const getLabelX = () => {
                if (chartSettings.useXLog) {
                  const x =
                    range.start === 0
                      ? xScale(initialDaysSinceGenesis + 3)
                      : xScale(range.start + 20);

                  return Math.max(x, getDaysFromStartDate(startDate) + 2);
                }
                const x =
                  range.start === bitcoinHalvingEpochs[0].getTime()
                    ? xScale(startDate.getTime() + fiveDays)
                    : xScale(range.start + fiveDays);
                return Math.max(x, xScale(startDate.getTime() + fiveDays));
              };

              return (
                <Fragment key={range.start}>
                  <path
                    d={areaGenerator(epochData as any) ?? undefined}
                    fill={`url(#pattern-${index})`}
                    fillOpacity={0.2}
                    stroke={range.color}
                    strokeWidth={1}
                    className={isAnimatingOut ? 'epoch-fade-out' : 'epoch-fade-in'}
                    style={{
                      animationDelay: isAnimatingOut ? '0s' : `${index * 0.1}s`
                    }}
                  />
                  <rect
                    x={getLabelX()}
                    y={innerHeight - 18}
                    width={75}
                    height={16}
                    fill={colorMode === 'dark' ? '#1A202C' : '#fff'}
                    className={isAnimatingOut ? 'epoch-fade-out' : 'epoch-fade-in'}
                    style={{
                      animationDelay: isAnimatingOut ? '0s' : `${index * 0.1}s`
                    }}
                  />
                  <text
                    x={getLabelX() + 5}
                    y={innerHeight}
                    textAnchor="left"
                    dy={-6}
                    fill={range.color}
                    fontSize={12}
                    fontFamily={'courier'}
                    className={isAnimatingOut ? 'epoch-fade-out' : 'epoch-fade-in'}
                    style={{
                      animationDelay: isAnimatingOut ? '0s' : `${index * 0.1}s`
                    }}
                  >
                    {' '}
                    Epoch {convertToRomanNumeral(index + 1)}{' '}
                    {/* { chartSettings.useXLog ? dayjs(genesis).add(range.start, 'day').format('YYYY-MM-DD') : dayjs(range.start).format('YYYY-MM-DD')} */}
                  </text>
                </Fragment>
              );
            }
          )}
        </g>
      </>
    );
  };

  const BeaconLayer = ({ series, xScale, yScale }: any) => {
    const [showBeacon, setShowBeacon] = useState(false);
    const prevLatestPrice = useRef(latestPrice);
    const prevTrigger = useRef(triggerBeacon);

    useEffect(() => {
      // Trigger beacon animation when latestPrice changes
      if (
        latestPrice &&
        latestPrice !== prevLatestPrice.current &&
        prevLatestPrice.current !== undefined
      ) {
        setShowBeacon(true);
        const timeout = setTimeout(() => {
          setShowBeacon(false);
        }, 2000); // Animation duration
        return () => clearTimeout(timeout);
      }
      prevLatestPrice.current = latestPrice;
    }, [latestPrice]);

    useEffect(() => {
      // Trigger beacon animation manually via triggerBeacon prop
      if (triggerBeacon !== undefined && triggerBeacon !== prevTrigger.current) {
        setShowBeacon(true);
        const timeout = setTimeout(() => {
          setShowBeacon(false);
        }, 2000); // Animation duration
        prevTrigger.current = triggerBeacon;
        return () => clearTimeout(timeout);
      }
    }, [triggerBeacon]);

    if (!showBeacon || !latestPrice) return null;

    // Find the price series to get the color and latest data point
    const priceSeries = series.find((s: any) => s.id === 'price');
    if (!priceSeries || !priceSeries.data || priceSeries.data.length === 0) return null;

    const priceData = priceSeries.data.filter((d: any) => d.data.y > 0);
    const lastPoint = priceData[priceData.length - 1];
    const x = xScale(lastPoint.data.x);
    const y = yScale(lastPoint.data.y);
    const color = priceSeries.color;

    return (
      <g style={{ pointerEvents: 'none' }}>
        <style>
          {`
            @keyframes beacon-pulse {
              0% {
                r: 4;
                opacity: 0.5;
              }
              100% {
                r: 30;
                opacity: 0;
              }
            }
            @keyframes beacon-fade {
              0% {
                opacity: 0.9;
              }
              70% {
                opacity: 0.9;
              }
              100% {
                opacity: 0;
              }
            }
          `}
        </style>
        {/* Three concentric circles with staggered animations */}
        <circle
          cx={x}
          cy={y}
          r={4}
          fill="none"
          stroke={color}
          strokeWidth={2}
          opacity={0.8}
          style={{
            animation: 'beacon-pulse 2s ease-out'
          }}
        />
        <circle
          cx={x}
          cy={y}
          r={4}
          fill="none"
          stroke={color}
          strokeWidth={2}
          opacity={0.8}
          style={{
            animation: 'beacon-pulse 2s ease-out 0.3s'
          }}
        />
        <circle
          cx={x}
          cy={y}
          r={4}
          fill="none"
          stroke={color}
          strokeWidth={2}
          opacity={0.8}
          style={{
            animation: 'beacon-pulse 2s ease-out 0.6s'
          }}
        />
        {/* Center dot */}
        <circle
          cx={x}
          cy={y}
          r={2}
          fill={color}
          opacity={0.9}
          style={{
            animation: 'beacon-fade 2s ease-out'
          }}
        />
      </g>
    );
  };

  const LoadingLayer = ({
    innerWidth,
    innerHeight
  }: {
    innerWidth: number;
    innerHeight: number;
  }) => {
    return isLoading ? (
      <g>
        <style>
          {`
            @keyframes pulse {
              0%, 100% { opacity: 0.3; }
              50% { opacity: 0.7; }
            }
          `}
        </style>
        <rect
          x={0}
          y={0}
          width={innerWidth}
          height={innerHeight}
          fill={colorMode === 'dark' ? '#1A202C' : '#fff'}
          opacity={0.8}
          style={{
            animation: 'pulse 2s ease-in-out infinite'
          }}
        />
      </g>
    ) : null;
  };

  return {
    AreaLayer,
    CustomLineLayer,
    EpochLayer,
    BeaconLayer,
    LoadingLayer
  };
};
