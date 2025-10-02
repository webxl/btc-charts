import { ResponsiveLine, SliceTooltipProps } from '@nivo/line';
import { nivoThemes, epochColors } from '../../theme.ts';
import { useColorMode } from '@chakra-ui/system';
import { Fragment, ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box } from '@chakra-ui/react';
import dayjs from 'dayjs';

import {
  generatePriceBands,
  AnalysisFormData,
  priceBandLabels,
  PriceBandTypes,
  DailyPriceDatum
} from '../../calc.ts';
import {
  formatCurrency,
  formatCurrencyForAxis,
  formatCurrencyWithCents,
  convertToRomanNumeral
} from '../../utils.ts';
import { bitcoinHalvingEpochs, powerLawColor, sigmaBandColor } from '../../const.ts';

import { linearGradientDef, Defs, useAnimatedPath, useMotionConfig } from '@nivo/core';
import { area } from 'd3-shape';

import { ChartSettings } from '../ChartControls.tsx';

import { useSpring, animated, to } from '@react-spring/web';
import { useTouchEvents, useMouseEvents } from './utils.tsx';

type Datum = { x: number; y: number | null };

const AreaPath = ({
  areaBlendMode,
  areaOpacity,
  color,
  fill,
  path
}: {
  areaBlendMode: string;
  areaOpacity: number;
  color: string;
  fill: string | undefined;
  path: string;
}) => {
  const { animate, config: springConfig } = useMotionConfig();

  const animatedPath = useAnimatedPath(path);
  const animatedProps = useSpring({
    color,
    config: springConfig,
    immediate: !animate
  });

  return (
    <animated.path
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      d={to(animatedPath, p => p || '')}
      fill={fill ? fill : animatedProps.color}
      fillOpacity={areaOpacity}
      strokeWidth={0}
      style={{
        mixBlendMode: areaBlendMode as React.CSSProperties['mixBlendMode']
      }}
    />
  );
};

const PowerLawChart = ({
  dailyPriceData,
  parameters,
  onDateRangeAdjusted,
  chartSettings,
  shouldAnimate = false,
  mobileZoomPanMode = false
}: {
  dailyPriceData: DailyPriceDatum[];
  parameters: AnalysisFormData;
  onDateRangeAdjusted: (startDate: string, endDate: string) => void;
  chartSettings: ChartSettings;
  shouldAnimate: boolean;
  mobileZoomPanMode?: boolean;
}) => {
  const { colorMode } = useColorMode();

  const _startDate = dayjs(parameters.analysisStart).toDate();
  const _endDate = dayjs(parameters.analysisEnd).toDate();

  const [startDate, setStartDate] = useState(_startDate);
  const [endDate, setEndDate] = useState(_endDate);
  const startDateRef = useRef(startDate);
  const endDateRef = useRef(endDate);
  const onDateRangeAdjustedRef = useRef(onDateRangeAdjusted);

  useEffect(() => {
    startDateRef.current = startDate;
    endDateRef.current = endDate;
    onDateRangeAdjustedRef.current = onDateRangeAdjusted;
  }, [startDate, endDate, onDateRangeAdjusted]);

  const getDaysFromStartDate = useCallback(
    (curDate: Date) => dayjs(curDate).diff(startDate, 'day'),
    [startDate]
  );

  const genesis = useMemo(() => new Date(2009, 0, 3), []);
  const initialDaysSinceGenesis = -1 * getDaysFromStartDate(genesis);
  const endDateDaysSinceGenesis = initialDaysSinceGenesis + getDaysFromStartDate(endDate);

  const [highestPriceInData, setHighestPriceInData] = useState(0);
  const [lowestPriceInData, setLowestPriceInData] = useState(Number.MAX_VALUE);

  const data = useMemo((): readonly { id: string; color: string; data: Datum[] }[] => {
    const priceBands = generatePriceBands(
      startDate,
      endDate,
      dailyPriceData,
      chartSettings.useXLog,
      800
    );

    let highestPrice = 0,
      lowestPrice = Number.MAX_VALUE;

    const data = Object.entries(priceBands)
      .filter(([type]) => {
        return (
          (type === 'price' && chartSettings.showPricePlot) ||
          (type === 'powerLaw' && chartSettings.showPowerLawPlot) ||
          (type === 'posOneSigma' && chartSettings.showInnerBand) ||
          (type === 'posTwoSigma' && chartSettings.showOuterBand) ||
          (type === 'negOneSigma' && chartSettings.showInnerBand) ||
          (type === 'negTwoSigma' && chartSettings.showOuterBand)
        );
      })
      .map(([type, data]) => ({
        id: type,
        color:
          type === (PriceBandTypes.powerLaw as string)
            ? powerLawColor
            : type === (PriceBandTypes.price as string)
              ? '#77d926'
              : 'transparent',
        data: data
          .map(d => {
            highestPrice = Math.max(highestPrice, d.price);
            if (d.price > 0) {
              lowestPrice = Math.min(lowestPrice, d.price);
            }
            const date = dayjs(d.date).tz('America/Los_Angeles').toDate();
            return chartSettings.useXLog
              ? {
                  x: initialDaysSinceGenesis + getDaysFromStartDate(date),
                  y: d.price <= 0 ? null : d.price
                }
              : {
                  x: date.getTime(),
                  y: d.price <= 0 ? null : d.price
                };
          })
          .filter(d => !chartSettings.useYLog || (d.y !== null && d.y > 0))
      }));
    setHighestPriceInData(highestPrice);
    setLowestPriceInData(Math.max(lowestPrice, 0.01));
    return data;
  }, [
    dailyPriceData,
    endDate,
    getDaysFromStartDate,
    initialDaysSinceGenesis,
    startDate,
    chartSettings
  ]);

  const minX = useMemo(() => {
    return chartSettings.useXLog ? initialDaysSinceGenesis : startDate.getTime();
  }, [initialDaysSinceGenesis, chartSettings.useXLog, startDate]);

  const maxX = useMemo(() => {
    return chartSettings.useXLog ? endDateDaysSinceGenesis : endDate.getTime();
  }, [endDateDaysSinceGenesis, chartSettings.useXLog, endDate]);

  const minY = useMemo(() => {
    return chartSettings.useYLog ? lowestPriceInData : 0;
  }, [chartSettings.useYLog, lowestPriceInData]);

  const maxY = useMemo(() => {
    return chartSettings.useYLog ? highestPriceInData : 'auto';
  }, [chartSettings.useYLog, highestPriceInData]);

  const tooltipRef = useRef<HTMLDivElement>(null);

  const sliceTooltip = useCallback(
    ({ slice }: SliceTooltipProps<{ id: string; color: string; data: Datum[] }>) => {
      const xFormatted = slice.points[0].data.xFormatted;
      const seenLabels = new Set<PriceBandTypes>();
      const allYValuesUnder1000 = slice.points.every(p => p.data.y !== null && p.data.y < 1000);

      if (mobileZoomPanMode) {
        return null;
      }
      return (
        <Box
          ref={tooltipRef}
          background={colorMode === 'dark' ? '#1A202CCC' : 'whiteAlpha.900'}
          padding="9px 12px"
          border="1px solid"
          borderColor={colorMode === 'dark' ? 'white.alpha.300' : 'black.alpha.300'}
          borderRadius="md"
          fontSize="10pt"
          transition="opacity 0.3s ease-in-out"
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
                {`${dayjs(genesis)
                  .add(Number(xFormatted), 'day')
                  .tz('America/Los_Angeles')
                  .format('MMM D, YYYY')}`}
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
    },
    [colorMode, genesis, chartSettings.useXLog, mobileZoomPanMode]
  );

  // layers
  const AreaLayer = ({ series, xScale, yScale, innerHeight }: any) => {
    const getArea = (lowerBound: readonly any[], upperBound: readonly any[]) => {
      // Ensure both bounds have the same length and valid data
      if (!lowerBound || !upperBound || lowerBound.length === 0 || upperBound.length === 0) {
        return null;
      }

      // Ensure both arrays have the same length by using the minimum length
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
        <Defs
          defs={[
            {
              id: 'pattern',
              type: 'patternLines',
              background: 'transparent',
              color: sigmaBandColor,
              lineWidth: 1,
              spacing: 6,
              rotation: -45
            },
            {
              id: 'pattern2',
              type: 'patternLines',
              background: 'transparent',
              color: sigmaBandColor,
              lineWidth: 1,
              spacing: 6,
              rotation: 45
            }
          ]}
        />
        {chartSettings.showOuterBand && outerBand && (
          <AreaPath
            areaBlendMode={'normal'}
            areaOpacity={0.2}
            color={'#3daff7'}
            fill={'#3daff7'}
            path={outerBand}
          />
        )}
        {chartSettings.showInnerBand && innerBand && (
          <AreaPath
            areaBlendMode={'normal'}
            areaOpacity={0.3}
            color={'#3daff7'}
            fill={'#3daff7'}
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
          // Filter out invalid data points (null, undefined, NaN)
          const validPoints = serie.data
            .filter((d: any) => d.data.y !== null && d.data.y !== undefined && !isNaN(d.data.y))
            .map((d: any) => ({
              x: xScale(d.data.x),
              y: yScale(d.data.y)
            }));

          // Skip rendering if no valid points
          if (validPoints.length === 0) return null;

          return (
            <path
              key={serie.id}
              d={lineGenerator(validPoints)}
              fill="none"
              stroke={serie.color}
              strokeWidth={serie.id === 'price' ? 2 : serie.id === 'powerLaw' ? 2 : 0}
              data-id={serie.id}
              data-type={'line'}
              style={{ pointerEvents: 'none' }}
            />
          );
        })}
      </g>
    );
  };

  const EpochLayer = ({ xScale, innerHeight }: any) => {
    if (!chartSettings.showHalvingEpochs) return null;

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
          defs={epochColors[colorMode].map((color, index) => ({
            id: `pattern-${index}`,
            type: 'patternLines',
            background: 'transparent',
            color: color,
            lineWidth: 1,
            spacing: 6,
            rotation: -45
          }))}
        />

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
                />
                <rect
                  x={getLabelX()}
                  y={innerHeight - 18}
                  width={75}
                  height={16}
                  fill={colorMode === 'dark' ? '#1A202C' : '#fff'}
                  opacity={0.9}
                />
                <text
                  x={getLabelX() + 5}
                  y={innerHeight}
                  textAnchor="left"
                  dy={-6}
                  fill={range.color}
                  fontSize={12}
                  fontFamily={'courier'}
                >
                  {' '}
                  Epoch {convertToRomanNumeral(index + 1)}{' '}
                  {/* { chartSettings.useXLog ? dayjs(genesis).add(range.start, 'day').format('YYYY-MM-DD') : dayjs(range.start).format('YYYY-MM-DD')} */}
                </text>
              </Fragment>
            );
          }
        )}
      </>
    );
  };

  // Scroll state
  const [isScrolling, setIsScrolling] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Convert mouse X position to date
  const mouseXToDate = useCallback(
    (mouseX: number): Date => {
      const container = chartContainerRef.current;
      if (!container) return startDate;

      const rect = container.getBoundingClientRect();
      const chartWidth = rect.width - 41; // Account for left margin (40px + 1px)
      const relativeX = mouseX - rect.left - 40; // Subtract left margin
      const normalizedX = Math.max(0, Math.min(1, relativeX / chartWidth));

      if (chartSettings.useXLog) {
        const xRange = endDateDaysSinceGenesis - initialDaysSinceGenesis;
        const daysSinceGenesis = initialDaysSinceGenesis + normalizedX * xRange;
        return dayjs(genesis).add(daysSinceGenesis, 'day').toDate();
      } else {
        const timeRange = endDate.getTime() - startDate.getTime();
        const timestamp = startDate.getTime() + normalizedX * timeRange;
        return new Date(timestamp);
      }
    },
    [
      startDate,
      endDate,
      chartSettings.useXLog,
      initialDaysSinceGenesis,
      endDateDaysSinceGenesis,
      genesis
    ]
  );

  const {
    isDragging,
    dragStart,
    dragEnd,
    handleScroll,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp
  } = useMouseEvents(
    chartContainerRef,
    mouseXToDate,
    setStartDate,
    setEndDate,
    onDateRangeAdjusted,
    setIsScrolling,
    startDate,
    endDate
  );

  const { handleTouchStart, handleTouchMove, handleTouchEnd } = useTouchEvents(
    chartContainerRef,
    mobileZoomPanMode,
    setIsScrolling,
    startDateRef,
    endDateRef,
    setStartDate,
    setEndDate,
    onDateRangeAdjustedRef
  );

  useEffect(() => {
    const currentContainer = chartContainerRef.current;
    if (!currentContainer) return;

    currentContainer.addEventListener('wheel', handleScroll, { passive: false });
    currentContainer.addEventListener('touchstart', handleTouchStart, { passive: false });
    currentContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
    currentContainer.addEventListener('touchend', handleTouchEnd);

    return () => {
      currentContainer.removeEventListener('wheel', handleScroll);
      currentContainer.removeEventListener('touchstart', handleTouchStart);
      currentContainer.removeEventListener('touchmove', handleTouchMove);
      currentContainer.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleScroll, handleTouchStart, handleTouchMove, handleTouchEnd]);

  useEffect(() => {
    if (isScrolling) return;
    const start = dayjs(parameters.analysisStart);
    const end = dayjs(parameters.analysisEnd);
    if (start.format('L') !== dayjs(startDate).format('L')) {
      setStartDate(start.toDate());
    }
    if (end.format('L') !== dayjs(endDate).format('L')) {
      setEndDate(end.toDate());
    }
  }, [endDate, isScrolling, parameters, startDate]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (tooltipRef.current) {
      const shouldHide = isDragging || isScrolling || mobileZoomPanMode;
      timeout = setTimeout(
        () => {
          if (tooltipRef.current) {
            tooltipRef.current.style.opacity = shouldHide ? '0' : '1';
          }
        },
        shouldHide ? 0 : 300
      );
    }
    return () => clearTimeout(timeout);
  }, [isDragging, isScrolling, mobileZoomPanMode]);

  const middleLogValues = useMemo(() => {
    const values = [];
    for (let i = 0; i < 10; i++) {
      const val = Math.pow(10, i);
      if (val > lowestPriceInData && val < highestPriceInData) {
        values.push(val);
      }
    }
    return values;
  }, [highestPriceInData, lowestPriceInData]);

  const yAxisTickValues = useMemo(() => {
    if (chartSettings.useYLog) {
      const allValues = [lowestPriceInData, ...middleLogValues, highestPriceInData];

      // Remove duplicates and values that are too close (within 20% of each other)
      const filtered = allValues.filter((value, index) => {
        if (index === 0) return true; // Always keep the first value

        const prevValue = allValues[index - 1];
        const ratio = value / prevValue;

        // Keep values that are at least 2x different from the previous
        return ratio >= 2;
      });

      return filtered;
    }
    return 5;
  }, [chartSettings.useYLog, lowestPriceInData, middleLogValues, highestPriceInData]);

  // Selection overlay component
  const SelectionOverlay = () => {
    if (!isDragging || !dragStart || !dragEnd) return null;

    const left = Math.min(dragStart.x, dragEnd.x);
    const width = Math.abs(dragEnd.x - dragStart.x);
    const startDateForRange = dragStart.date < dragEnd.date ? dragStart.date : dragEnd.date;
    const endDateForRange = dragStart.date < dragEnd.date ? dragEnd.date : dragStart.date;
    const daysDiff = Math.abs(dayjs(endDateForRange).diff(startDateForRange, 'day'));
    const validDateRange = daysDiff >= 30;
    return (
      <div
        style={{
          position: 'absolute',
          left: `${left}px`,
          top: '20px', // Match chart margin top
          width: `${width}px`,
          height: 'calc(100% - 60px)', // Account for top and bottom margins
          backgroundColor: validDateRange ? 'rgba(249, 115, 22, 0.3)' : 'rgba(249, 115, 22, 0.1)',
          pointerEvents: 'none',
          zIndex: 1000
        }}
      />
    );
  };

  return (
    <Box
      height={'calc(100vh - 250px)'}
      minHeight={350}
      style={{
        touchAction: 'none',
        overflow: 'visible',
        position: 'relative',
        userSelect: 'none',
        cursor: isDragging ? 'col-resize' : 'crosshair',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none'
      }}
      minW={0}
      width={'auto'}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div ref={chartContainerRef} style={{ position: 'relative', height: '100%', width: '100%' }}>
        <SelectionOverlay />
        <ResponsiveLine
          animate={shouldAnimate && !isScrolling}
          data={data}
          colors={{
            datum: 'color'
          }}
          margin={{ top: 20, right: 1, bottom: 40, left: 40 }}
          // @ts-ignore
          theme={{ ...nivoThemes[colorMode], tooltip: { zIndex: 10000 } }}
          xFormat={chartSettings.useXLog ? '.0f' : 'time:%b %d, %Y'}
          yFormat=" >-$,.0f"
          xScale={{
            type: chartSettings.useXLog ? 'log' : 'linear',
            min: minX,
            max: maxX,
            nice: false
          }}
          yScale={{
            type: chartSettings.useYLog ? 'log' : 'linear',
            min: minY,
            max: maxY,
            nice: false
          }}
          axisBottom={{
            format: chartSettings.useXLog
              ? '.0f'
              : (d: Date) =>
                  data[0]?.data.length > 60
                    ? dayjs(d).format('MMM YYYY')
                    : dayjs(d).format('M/DD/YY'),
            tickPadding: 5,
            tickRotation: -35,
            legendOffset: 0,
            legendPosition: 'middle'
          }}
          gridYValues={yAxisTickValues}
          axisLeft={{
            format: (d: number) => formatCurrencyForAxis(d),
            tickPadding: 5,
            tickValues: yAxisTickValues,
            legendOffset: 0,
            legendPosition: 'middle'
          }}
          pointSize={0}
          pointBorderWidth={1}
          pointBorderColor={{
            from: 'color',
            modifiers: [['darker', 0.3]]
          }}
          crosshairType="x"
          enableTouchCrosshair={!isDragging && !isScrolling && !mobileZoomPanMode}
          enableSlices={isDragging || isScrolling || mobileZoomPanMode ? false : 'x'}
          sliceTooltip={sliceTooltip}
          defs={[
            linearGradientDef('gradientA', [
              { offset: 0, color: 'inherit' },
              { offset: 100, color: 'inherit', opacity: 0 }
            ])
          ]}
          fill={[{ match: '*', id: 'gradientA' }]}
          legends={[]}
          layers={[
            'grid',
            'areas',
            AreaLayer,
            'axes',
            'crosshair',
            CustomLineLayer,
            EpochLayer,
            'markers',
            'legends',
            'slices',
            'mesh'
          ]}
        />
      </div>
    </Box>
  );
};

export default PowerLawChart;
