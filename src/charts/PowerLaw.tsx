import { ResponsiveLine, SliceTooltipProps } from '@nivo/line';
import { nivoThemes } from '../theme.ts';
import { useColorMode } from '@chakra-ui/system';
import { Fragment, ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box } from '@chakra-ui/react';
import dayjs from 'dayjs';
import { generatePriceBands, AnalysisFormData, priceBandLabels, PriceBandTypes, DailyPriceDatum } from '../calc.ts';
import { formatCurrency, formatCurrencyForAxis, formatCurrencyWithCents } from '../utils.ts';
import { linearGradientDef, Defs, useAnimatedPath, useMotionConfig } from '@nivo/core';
import { area } from 'd3-shape';
import { debounce } from 'lodash';

import { ChartSettings } from './ChartControls';

const powerLawColor = '#f47560';
const sigmaBandColor = '#3daff7';

import { useSpring, animated, to } from '@react-spring/web';

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
      d={to(animatedPath, (p) => p || '')} 
      fill={fill ? fill : animatedProps.color}
      fillOpacity={areaOpacity}
      strokeWidth={0}
      style={{
        mixBlendMode: areaBlendMode as React.CSSProperties['mixBlendMode']
      }}
    />
  );
};

type Datum = { x: number; y: number | null };

const PowerLawChart = ({
  dailyPriceData,
  parameters,
  onDateRangeAdjusted,
  chartSettings,
  shouldAnimate = false
}: {
  dailyPriceData: DailyPriceDatum[];
  parameters: AnalysisFormData;
  onDateRangeAdjusted: (startDate: string, endDate: string) => void;
  chartSettings: ChartSettings;
  shouldAnimate: boolean;
}) => {

  const { colorMode } = useColorMode();

  const _startDate = dayjs(parameters.analysisStart).toDate();
  const _endDate = dayjs(parameters.analysisEnd).toDate();

  const [startDate, setStartDate] = useState(_startDate);
  const [endDate, setEndDate] = useState(_endDate);

  const getDaysFromStartDate = useCallback((curDate: Date) => dayjs(curDate).diff(startDate, 'day'), [startDate]);

  const genesis = useMemo(() => new Date(2009, 0, 3), []);
  const initialDaysSinceGenesis = -1 * getDaysFromStartDate(genesis);
  const endDateDaysSinceGenesis = initialDaysSinceGenesis + getDaysFromStartDate(endDate);

  const [highestPriceInData, setHighestPriceInData] = useState(0);
  const [lowestPriceInData, setLowestPriceInData] = useState(Number.MAX_VALUE);

  const data = useMemo((): readonly { id: string; color: string; data: Datum[] }[] => {
    const priceBands = generatePriceBands(startDate, endDate, dailyPriceData, chartSettings.useXLog, 800);
    let highestPrice = 0;
    let lowestPrice = Number.MAX_VALUE;
    const data = (
      Object.entries(priceBands)
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
            type === PriceBandTypes.powerLaw as string
              ? powerLawColor
              : type === PriceBandTypes.price as string
                ? '#77d926'
                : 'transparent',
          data: data
            .map(d => {
              highestPrice = Math.max(highestPrice, d.price);
              if (d.price > 0) {
                lowestPrice = Math.min(lowestPrice, d.price);
              }
              return chartSettings.useXLog
                ? {
                  x: initialDaysSinceGenesis + getDaysFromStartDate(new Date(d.date)),
                  y: d.price <= 0 ? null : d.price
                }
                : {
                  x: new Date(d.date).getTime(),
                  y: d.price <= 0 ? null : d.price
                }
            })
            .filter(d => !chartSettings.useYLog || (d.y !== null && d.y > 0)) 
        }))
    );
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
      return (
        <Box
          ref={tooltipRef}
          background={colorMode === 'dark' ? '#1A202Ccc' : 'whiteAlpha.600'}
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
              marginBottom: '10px',
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
                  .format('MMM D, YYYY')}`}
              </span>
            )}
          </div>
          {Array.prototype.sort
            .call(slice.points, (p1: any, p2: any) => (p1.data.y < p2.data.y ? 1 : -1))
            .filter((p: any) => p.data.xFormatted === xFormatted)
            .map((point: any): ReactElement | undefined => {
              const price = point.data.y as number;
              if (seenLabels.has(point.seriesId as PriceBandTypes)) { // overlapping point fix
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
    [colorMode, genesis, chartSettings.useXLog]
  );

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
          return i < trimmedLower.length && 
                 d.data.y !== null && 
                 trimmedLower[i].data.y !== null &&
                 (!chartSettings.useYLog || (d.data.y > 0 && trimmedLower[i].data.y > 0));
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

    const lowerOuterBound = (series as readonly any[]).find((s) => s.id === PriceBandTypes.negTwoSigma)?.data ?? [];
    const upperOuterBound = (series as readonly any[]).find((s) => s.id === PriceBandTypes.posTwoSigma)?.data ?? [];
    const lowerInnerBound = (series as readonly any[]).find((s) => s.id === PriceBandTypes.negOneSigma)?.data ?? [];
    const upperInnerBound = (series as readonly any[]).find((s) => s.id === PriceBandTypes.posOneSigma)?.data ?? [];

    const outerBand = chartSettings.showOuterBand ? getArea(lowerOuterBound, upperOuterBound) : null;
    const innerBand = chartSettings.showInnerBand ? getArea(lowerInnerBound, upperInnerBound) : null;

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

  const bitcoinHalvingEpochs = [
    new Date('2009-01-03'),
    new Date('2012-11-28'),
    new Date('2016-07-08'),
    new Date('2020-05-11'),
    new Date('2024-04-19'),
    new Date('2028-03-26'),
    new Date('2032-02-22'),
    new Date('2036-01-29'),
    new Date('2040-01-06'),
  ];

  const convertToRomanNumeral = (num: number) => {    
    const romanNumerals = {
      M: 1000,
      CM: 900,
      D: 500,
      CD: 400,
      C: 100,
      XC: 90,
      L: 50,
      XL: 40,
      X: 10,
      IX: 9,
      V: 5,
      IV: 4,
      I: 1
    };
    let roman = '';
    for (let key of Object.keys(romanNumerals)) {
      let matches = Math.floor(num / romanNumerals[key as keyof typeof romanNumerals]);
      roman += key.repeat(matches);
      num -= matches * romanNumerals[key as keyof typeof romanNumerals];
    }
    return roman;
  };

  const EpochLayer = ({ xScale, innerHeight }: any) => {
    
    if (!chartSettings.showHalvingEpochs) return null;

    const areaGenerator = area()
      .x((d: any) => xScale(d.data.x))
      .y0(() => innerHeight)
      .y1(() => 0);

    const epochColors = ['#3daff7', '#f47560', '#e8c1a0', '#97e3d5', '#ff66ff', '#61cdbb' ,'#3daff7', '#d5a6ff', '#f1e15b' ];

    const epochRanges = bitcoinHalvingEpochs.map((epoch: Date, index: number) => {
      const start = chartSettings.useXLog 
        ? initialDaysSinceGenesis + getDaysFromStartDate(epoch)
        : epoch.getTime();
      const nextEpoch = bitcoinHalvingEpochs[index + 1];
      const end = nextEpoch 
        ? (chartSettings.useXLog 
            ? initialDaysSinceGenesis + getDaysFromStartDate(nextEpoch)
            : nextEpoch.getTime())
        : undefined;
      return { start, end, color: epochColors[index % epochColors.length] };
    });
  
    return (
      <>
        <Defs
          defs={epochColors.map((color, index) => ({
            id: `pattern-${index}`,
            type: "patternLines",
            background: "transparent",
            color: color,
            lineWidth: 1,
            spacing: 6,
            rotation: -45,
          }))}
        />
        
        {epochRanges.map((range: { start: number; end: number | undefined; color: string }, index: number) => {
          if (!range.end) return null;

          if ((chartSettings.useXLog && range.end < initialDaysSinceGenesis) || (!chartSettings.useXLog && range.end < startDate.getTime())) return null;
          
          const nextEpoch = epochRanges[index + 1];
          const epochData = [
            {
              data: {
                x: chartSettings.useXLog ?  (index === 0 ? initialDaysSinceGenesis : Math.max(range.start, initialDaysSinceGenesis)) 
                : (index === 0 ? startDate.getTime() : Math.max(range.start, startDate.getTime())),
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
              const x = range.start === 0 ? xScale(initialDaysSinceGenesis + 3) : xScale(range.start + 20);
              
              return Math.max(x, getDaysFromStartDate(startDate) + 2) ;
            }
            const x = range.start === bitcoinHalvingEpochs[0].getTime() ? xScale(startDate.getTime() + fiveDays) : xScale(range.start + fiveDays);
            return Math.max(x,  xScale(startDate.getTime() + fiveDays));
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
              > Epoch {convertToRomanNumeral(index + 1)}{' '}
                {/* { chartSettings.useXLog ? dayjs(genesis).add(range.start, 'day').format('YYYY-MM-DD') : dayjs(range.start).format('YYYY-MM-DD')} */}
              </text>
            </Fragment>
          );
        })}
      </>
    );
  };

  const [isScrolling, setIsScrolling] = useState(false);
  const lastDeltaXRef = useRef<number | null>(null);
  const lastDeltaYRef = useRef<number | null>(null);

  // Drag selection state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; date: Date } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ x: number; date: Date } | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const debouncedZoomEnd = useMemo(
    () =>
      debounce(() => {
        setIsScrolling(false);
        lastDeltaXRef.current = null;
        lastDeltaYRef.current = null;
      }, 250),
    []
  );

  // Convert mouse X position to date
  const mouseXToDate = useCallback((mouseX: number): Date => {
    const container = chartContainerRef.current;
    if (!container) return startDate;
    
    const rect = container.getBoundingClientRect();
    const chartWidth = rect.width - 41; // Account for left margin (40px + 1px)
    const relativeX = mouseX - rect.left - 40; // Subtract left margin
    const normalizedX = Math.max(0, Math.min(1, relativeX / chartWidth));
    
    if (chartSettings.useXLog) {
      const xRange = endDateDaysSinceGenesis - initialDaysSinceGenesis;
      const daysSinceGenesis = initialDaysSinceGenesis + (normalizedX * xRange);
      return dayjs(genesis).add(daysSinceGenesis, 'day').toDate();
    } else {
      const timeRange = endDate.getTime() - startDate.getTime();
      const timestamp = startDate.getTime() + (normalizedX * timeRange);
      return new Date(timestamp);
    }
  }, [startDate, endDate, chartSettings.useXLog, initialDaysSinceGenesis, endDateDaysSinceGenesis, genesis]);

  const handleScroll = useCallback(
    (e: WheelEvent) => {
      // Don't scroll if dragging
      if (isDragging) return;
      
      e.preventDefault();
      e.stopPropagation();

      const zoomFactor = -0.15;
      const deltaY = e.deltaY;
      const deltaX = e.deltaX;

      // Check if the scroll direction has changed
      if (
        (lastDeltaYRef.current !== null &&
          Math.sign(deltaY) !== Math.sign(lastDeltaYRef.current)) ||
        (lastDeltaXRef.current !== null && Math.sign(deltaX) !== Math.sign(lastDeltaXRef.current))
      ) {
        // Direction changed, ignore this event
        return;
      }

      lastDeltaXRef.current = deltaX;
      lastDeltaYRef.current = deltaY;

      if (!isScrolling) {
        setIsScrolling(true);
      }

      const dateRange = endDate.getTime() - startDate.getTime();
      const midPoint = new Date(startDate.getTime() + dateRange / 2);

      let newStartDate: Date, newEndDate: Date;

      if (deltaY > 0) {
        // Scrolling down, zoom in
        const newRange = dateRange * (1 - zoomFactor);
        newStartDate = new Date(midPoint.getTime() - newRange / 2);
        newEndDate = new Date(midPoint.getTime() + newRange / 2);
      } else if (deltaY < 0) {
        // Scrolling up, zoom out
        const newRange = dateRange * (1 + zoomFactor);
        newStartDate = new Date(midPoint.getTime() - newRange / 2);
        newEndDate = new Date(midPoint.getTime() + newRange / 2);
      } else if (deltaX > 0) {
        newStartDate = dayjs(startDate).add(1, 'month').toDate();
        newEndDate = dayjs(endDate).add(1, 'month').toDate();
      } else {
        newStartDate = dayjs(startDate).add(-1, 'month').toDate();
        newEndDate = dayjs(endDate).add(-1, 'month').toDate();
      }

      if (newStartDate <= new Date(2009, 1, 3)) {
        debouncedZoomEnd();
        return false;
      }

      setStartDate(newStartDate);
      setEndDate(newEndDate);
      onDateRangeAdjusted(
        dayjs(newStartDate).format('YYYY-MM-DD'),
        dayjs(newEndDate).format('YYYY-MM-DD')
      );
      debouncedZoomEnd();
    },
    [isScrolling, endDate, startDate, onDateRangeAdjusted, debouncedZoomEnd, isDragging]
  );
  const containerRef = useRef<HTMLDivElement>(null);

  // Mouse event handlers for drag selection
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start drag on left mouse button
    if (e.button !== 0) return;
    
    const date = mouseXToDate(e.clientX);
    const container = chartContainerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    setIsDragging(true);
    setDragStart({ x, date });
    setDragEnd({ x, date });
    
    // Prevent text selection
    e.preventDefault();
  }, [mouseXToDate]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStart) return;
    
    const date = mouseXToDate(e.clientX);
    const container = chartContainerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    setDragEnd({ x, date });
  }, [isDragging, dragStart, mouseXToDate]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging || !dragStart || !dragEnd) {
      setIsDragging(false);
      setDragStart(null);
      setDragEnd(null);
      return;
    }
    
    // Determine start and end dates (handle dragging in either direction)
    const startDateForRange = dragStart.date < dragEnd.date ? dragStart.date : dragEnd.date;
    const endDateForRange = dragStart.date < dragEnd.date ? dragEnd.date : dragStart.date;
    
    // Only update if there's a meaningful selection (more than 30 day difference)
    const daysDiff = Math.abs(dayjs(endDateForRange).diff(startDateForRange, 'day'));
    if (daysDiff > 30) {
      setStartDate(startDateForRange);
      setEndDate(endDateForRange);
      onDateRangeAdjusted(
        dayjs(startDateForRange).format('YYYY-MM-DD'),
        dayjs(endDateForRange).format('YYYY-MM-DD')
      );
    }
    
    // Reset drag state
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  }, [isDragging, dragStart, dragEnd, onDateRangeAdjusted]);

  // Global mouse up handler to handle mouse up outside the chart
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleMouseUp();
      }
    };
    
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDragging, handleMouseUp]);

  useEffect(() => {
    const currentContainer = containerRef.current;
    if (currentContainer) {
      currentContainer.addEventListener('wheel', handleScroll, { passive: false });
    }

    return () => {
      if (currentContainer) {
        currentContainer.removeEventListener('wheel', handleScroll);
      }
    };
  }, [handleScroll]);

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
      const shouldHide = isDragging || isScrolling;
      timeout = setTimeout(() => {
        if (tooltipRef.current) {
          tooltipRef.current.style.opacity = shouldHide ? '0' : '1';
        }
      }, shouldHide ? 0 : 300);
    }
    return () => clearTimeout(timeout);
  }, [isDragging, isScrolling]);

  const middleLogValues = useMemo(() => {
    const values = [];
    for (let i = 1; i < 10; i++) {
      const val = Math.pow(10, i);
      if (val > lowestPriceInData && val < highestPriceInData) {
        values.push(val);
      }
    }
    return values;
  }, [highestPriceInData, lowestPriceInData]);

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

  const plotLength = data[0]?.data.length;

  return (
    <Box
      height={'calc(100vh - 250px)'}
      minHeight={350}
      style={{ 
        touchAction: 'none', 
        overflow: 'visible',
        position: 'relative',
        cursor: isDragging ? 'col-resize' : 'crosshair'
      }}
      minW={0}
      width={'auto'}
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div ref={chartContainerRef} style={{ position: 'relative', height: '100%', width: '100%' }}>
        <SelectionOverlay />
        <ResponsiveLine
          animate={shouldAnimate}
          data={data}
          colors={{
            datum: 'color'
          }}
          margin={{ top: 20, right: 1, bottom: 40, left: 40 }}
          // @ts-ignore
          theme={{ ...nivoThemes[colorMode], tooltip: { zIndex: 10000 } }}
          crosshairType="x"
          xFormat={chartSettings.useXLog ? '.0f' : 'time:%b %d, %Y'}
          yFormat=" >-$,.0f"
          xScale={{
            type: chartSettings.useXLog ? 'log' : 'linear',
            min: minX,
            max: maxX,
            nice: false
          }}
          gridXValues={[]}
          yScale={{
            type: chartSettings.useYLog ? 'log' : 'linear',
            min: minY,
            max: maxY,
            nice: false
          }}
          gridYValues={chartSettings.useYLog ? [1, 1000, 1000000, 1000000000] : []}
          axisBottom={{
            format: chartSettings.useXLog ? '.0f' : (d: Date) => plotLength > 60 ? dayjs(d).format('MMM YYYY') : dayjs(d).format('M/DD/YY'),
            tickPadding: 5,
            tickRotation: -35,
            legendOffset: 0,
            legendPosition: 'middle'
          }}
          axisLeft={{
            format: (d: number) => formatCurrencyForAxis(d),
            tickPadding: 5,
            tickValues: chartSettings.useYLog ? [lowestPriceInData, ...middleLogValues, highestPriceInData] : 5,
            legendOffset: 0,
            legendPosition: 'middle'
          }}
          pointSize={0}
          pointBorderWidth={1}
          pointBorderColor={{
            from: 'color',
            modifiers: [['darker', 0.3]]
          }}
          enableTouchCrosshair={!isDragging && !isScrolling}
          enableSlices={isDragging || isScrolling ? false : "x"}
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
            'lines',
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
