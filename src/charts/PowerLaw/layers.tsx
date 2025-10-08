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
          strokeDasharray: String(pathLength),
          strokeDashoffset: String(pathLength),
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
  colorMode,
  initialDaysSinceGenesis,
  getDaysFromStartDate
}: {
  chartSettings: ChartSettings;
  startDate: Date;
  colorMode: 'dark' | 'light';
  initialDaysSinceGenesis: number;
  getDaysFromStartDate: (date: Date) => number;
}): {
  AreaLayer: React.FC<{ series: any; xScale: any; yScale: any; innerHeight: number }>;
  CustomLineLayer: React.FC<{ series: any; lineGenerator: any; xScale: any; yScale: any }>;
  EpochLayer: React.FC<{ xScale: any; innerHeight: number }>;
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
                (!chartSettings.useXLog && range.end < startDate.getTime())
              )
                return null;

              const nextEpoch = epochRanges[index + 1];
              const epochData = [
                {
                  data: {
                    x: chartSettings.useXLog
                      ? index === 0
                        ? initialDaysSinceGenesis
                        : Math.max(range.start, initialDaysSinceGenesis)
                      : index === 0
                        ? startDate.getTime()
                        : Math.max(range.start, startDate.getTime()),
                    y: 0
                  }
                },
                {
                  data: {
                    x: !!nextEpoch ? nextEpoch.start - 2 : range.start,
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

  return {
    AreaLayer,
    CustomLineLayer,
    EpochLayer
  };
};
