import { ResponsiveLine, SliceTooltipProps } from '@nivo/line';
import { nivoThemes } from '../../theme.ts';
import { useColorMode } from '@chakra-ui/system';
import { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box } from '@chakra-ui/react';
import dayjs from 'dayjs';

import {
  generatePriceBands,
  AnalysisFormData,
  priceBandLabels,
  PriceBandTypes,
  DailyPriceDatum
} from '../../calc.ts';
import { formatCurrency, formatCurrencyForAxis, formatCurrencyWithCents } from '../../utils.ts';
import { powerLawColor, sigmaBandColor } from '../../const.ts';

import { linearGradientDef } from '@nivo/core';

import { ChartSettings } from '../ChartControls.tsx';

import { useTouchEvents, useMouseEvents } from './utils.tsx';
import { useLayers } from './layers.tsx';

type Datum = { x: number; y: number | null };

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
              ? colorMode === 'dark'
                ? '#77d926'
                : 'blue'
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
    colorMode,
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

  // Scroll state
  const [isScrolling, setIsScrolling] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // layers
  const { AreaLayer, CustomLineLayer, EpochLayer } = useLayers({
    chartSettings,
    startDate,
    colorMode,
    initialDaysSinceGenesis,
    getDaysFromStartDate
  });

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
            EpochLayer,
            'areas',
            AreaLayer,
            'axes',
            'crosshair',
            CustomLineLayer,
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
