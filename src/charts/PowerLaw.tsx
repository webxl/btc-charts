import { ResponsiveLine, SliceTooltipProps } from '@nivo/line';
import { nivoThemes } from '../theme.ts';
import { useColorMode } from '@chakra-ui/system';
import { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  chartSettings
}: {
  dailyPriceData: DailyPriceDatum[];
  parameters: AnalysisFormData;
  onDateRangeAdjusted: (startDate: string, endDate: string) => void;
  chartSettings: ChartSettings;
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
    const priceBands = generatePriceBands(startDate, endDate, dailyPriceData, chartSettings.useXLog, chartSettings.useXLog ? 500 : 900);
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

  const sliceTooltip = useCallback(
    ({ slice }: SliceTooltipProps<{ id: string; color: string; data: Datum[] }>) => {
      const xFormatted = slice.points[0].data.xFormatted;
      const seenLabels = new Set<PriceBandTypes>();
      return (
        <div
          style={{
            background: colorMode === 'dark' ? '#333' : '#fff',
            padding: '9px 12px',
            border: '1px solid #ccc',
            fontSize: '10pt'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '20px',
              borderBottom: '1px solid',
              borderColor: colorMode === 'dark' ? '#ccc' : '#333'
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
                    {price > 10000 ? formatCurrency(price) : formatCurrencyWithCents(price)}
                  </div>
                </div>
              );
            })}{' '}
        </div>
      );
    },
    [colorMode, genesis, chartSettings.useXLog]
  );

  const AreaLayer = ({ series, xScale, yScale, innerHeight }: any) => {
    const getArea = (lowerBound: readonly any[]) =>
      area<any>()
        .x((d: any) => (typeof xScale === 'function' ? xScale(Number(d.data.x)) : 0))
        .y0((d: any) => {
          const y = Number(d.data.y);
          return chartSettings.useYLog && y <= 0 ? innerHeight : (typeof yScale === 'function' ? yScale(y) : 0) ?? 0;
        })
        .y1((_d: any, i: number) => {
          const y = Number(lowerBound[i].data.y);
          return chartSettings.useYLog && y <= 0 ? innerHeight : (typeof yScale === 'function' ? yScale(y) : 0) ?? 0;
        });

    const lowerOuterBound = (series as readonly any[]).find((s) => s.id === PriceBandTypes.negTwoSigma)?.data ?? [];
    const upperOuterBound = (series as readonly any[]).find((s) => s.id === PriceBandTypes.posTwoSigma)?.data ?? [];
    const lowerInnerBound = (series as readonly any[]).find((s) => s.id === PriceBandTypes.negOneSigma)?.data ?? [];
    const upperInnerBound = (series as readonly any[]).find((s) => s.id === PriceBandTypes.posOneSigma)?.data ?? [];

    const outerBand = chartSettings.showOuterBand ? getArea(lowerOuterBound)(upperOuterBound) : null;
    const innerBand = chartSettings.showInnerBand ? getArea(lowerInnerBound)(upperInnerBound) : null;

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

  const [isScrolling, setIsScrolling] = useState(false);
  const lastDeltaXRef = useRef<number | null>(null);
  const lastDeltaYRef = useRef<number | null>(null);

  const debouncedZoomEnd = useMemo(
    () =>
      debounce(() => {
        setIsScrolling(false);
        lastDeltaXRef.current = null;
        lastDeltaYRef.current = null;
      }, 250),
    []
  );

  const handleScroll = useCallback(
    (e: WheelEvent) => {
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
    [isScrolling, endDate, startDate, onDateRangeAdjusted, debouncedZoomEnd]
  );
  const containerRef = useRef<HTMLDivElement>(null);

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

  return (
    <Box
      height={'calc(100vh - 250px)'}
      minHeight={350}
      style={{ touchAction: 'none', overflow: 'visible' }}
      minW={0}
      width={'auto'}
      ref={containerRef}
    >
      <ResponsiveLine
        animate={!isScrolling}
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
          format: chartSettings.useXLog ? '.0f' : (d: Date) => dayjs(d).format('MMM YYYY'),
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
        enableTouchCrosshair={true}
        enableSlices="x"
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
          'markers',
          'legends',
          'slices',
          'mesh'
        ]}
      />
    </Box>
  );
};

export default PowerLawChart;
