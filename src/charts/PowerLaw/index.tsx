import { ResponsiveLine } from '@nivo/line';
import { nivoThemes } from '../../theme.ts';
import { useColorMode } from '@chakra-ui/system';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box } from '@chakra-ui/react';
import dayjs from 'dayjs';
import * as scale from 'd3-scale';

import {
  generatePriceBands,
  AnalysisFormData,
  PriceBandTypes,
  DailyPriceDatum
} from '../../calc.ts';
import { formatCurrencyForAxis } from '../../utils.ts';
import { powerLawColor, darkPriceColor } from '../../const.ts';

import { linearGradientDef } from '@nivo/core';

import { ChartSettings } from '../ChartControls.tsx';

import { useTouchEvents, useMouseEvents } from './utils.tsx';
import { useLayers } from './layers.tsx';
import React from 'react';
import { SliceTooltip } from './Tooltip.tsx';

type Datum = { x: number; y: number | null };

type PowerLawChartProps = {
  dailyPriceData: DailyPriceDatum[];
  parameters: AnalysisFormData;
  onDateRangeAdjusted: (startDate: string, endDate: string) => void;
  chartSettings: ChartSettings;
  shouldAnimate?: boolean;
  mobileZoomPanMode?: boolean;
  isLoading?: boolean;
  latestPrice?: number;
  triggerBeacon?: number;
  animationEnabled?: boolean;
};

export type PowerLawChartRef = {
  showTooltipAtDate: (targetDate?: Date) => void;
  hideCrosshairAndTooltip: () => void;
};

const PowerLawChart = React.forwardRef<PowerLawChartRef, PowerLawChartProps>(
  (
    {
      dailyPriceData,
      parameters,
      onDateRangeAdjusted,
      chartSettings,
      shouldAnimate = false,
      mobileZoomPanMode = false,
      isLoading = false,
      latestPrice,
      triggerBeacon,
      animationEnabled = true
    },
    ref
  ) => {
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
        latestPrice || 0,
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
                  ? darkPriceColor
                  : 'blue'
                : 'transparent',
          data: data
            .map(d => {
              highestPrice = Math.max(highestPrice, d.price);
              if (d.price > 0) {
                lowestPrice = Math.min(lowestPrice, d.price);
              }
              const date = dayjs(d.date).toDate();
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
      chartSettings,
      latestPrice
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

    // Scroll state
    const [isScrolling, setIsScrolling] = useState(false);
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const innerDivRef = useRef<HTMLDivElement>(null);
    const [programmaticCrosshairX, setProgrammaticCrosshairX] = useState<number | null>(null);

    const [lastMeshTarget, setLastMeshTarget] = useState<SVGRectElement | null>(null);

    const showTooltipAtDate = useCallback(
      (targetDate?: Date) => {
        const container = chartContainerRef.current;
        if (!container) {
          return;
        }

        let xValue: number;

        if (!targetDate) {
          // Use the latest data point from the price series
          const priceSeries = data.find(series => series.id === 'price');
          if (!priceSeries || priceSeries.data.length === 0) return;
          const latestPoint = priceSeries.data[priceSeries.data.length - 1];
          xValue = latestPoint.x as number;
        } else {
          // Calculate x value from date
          if (chartSettings.useXLog) {
            xValue = initialDaysSinceGenesis + getDaysFromStartDate(targetDate);
          } else {
            xValue = targetDate.getTime();
          }
        }

        const rect = container.getBoundingClientRect();
        console.log(rect);
        const chartWidth = rect.width - 45; // Account for left margin
        // Find the mesh layer (Nivo's invisible layer that handles mouse events)
        const allRects = Array.from(container.querySelectorAll('svg rect'));

        let distanceFromCenter = Infinity;

        let meshTarget: SVGRectElement | null = null;

        // Create a scale to convert xValue to pixels
        const xScale = chartSettings.useXLog
          ? scale.scaleLog().domain([minX, maxX]).range([0, chartWidth])
          : scale.scaleTime().domain([minX, maxX]).range([0, chartWidth]);

        allRects.reverse().forEach(rect => {
          const style = window.getComputedStyle(rect);
          const pointerEvents = style.pointerEvents;
          const fill = rect.getAttribute('fill');
          const opacity = rect.getAttribute('opacity') || rect.getAttribute('fill-opacity');

          const distance = Math.abs(Number(rect.getAttribute('x')) - xScale(xValue));

          if (
            distance < distanceFromCenter &&
            pointerEvents !== 'none' &&
            (fill === 'transparent' || opacity === '0' || !fill)
          ) {
            distanceFromCenter = distance;
            meshTarget = rect as SVGRectElement;
          }
        });

        if (!meshTarget) {
          meshTarget = allRects[0] as SVGRectElement;
        }

        setLastMeshTarget(meshTarget);

        // Calculate x position ratio
        let xRatio: number;
        if (chartSettings.useXLog) {
          const logMin = Math.log(minX);
          const logMax = Math.log(maxX);
          const logTarget = Math.log(xValue);
          xRatio = (logTarget - logMin) / (logMax - logMin);
        } else {
          xRatio = (xValue - minX) / (maxX - minX);
        }

        const mouseX = 265 + xRatio * chartWidth; // Add left margin offset
        const mouseY = rect.height / 2; // Middle of chart

        // Set the crosshair position for our custom layer
        setProgrammaticCrosshairX(xValue);

        // Dispatch events to trigger tooltip
        const eventTypes = ['mouseenter', 'mousemove'];

        eventTypes.forEach(eventType => {
          const event = new MouseEvent(eventType, {
            bubbles: true,
            cancelable: true,
            clientX: rect.left + mouseX,
            clientY: rect.top + mouseY,
            view: window
          });

          if (meshTarget) {
            meshTarget.dispatchEvent(event);
          }
        });
      },
      [chartSettings.useXLog, minX, maxX, initialDaysSinceGenesis, getDaysFromStartDate, data]
    );

    // Expose the functions via ref
    React.useImperativeHandle(ref, () => ({
      showTooltipAtDate,
      hideCrosshairAndTooltip: () => {
        setProgrammaticCrosshairX(null);
        if (lastMeshTarget) {
          const event = new MouseEvent('mouseout', { bubbles: true });
          lastMeshTarget.dispatchEvent(event);
        }
      }
    }));

    useEffect(() => {
      if (triggerBeacon) {
        showTooltipAtDate(dayjs().startOf('day').toDate());
      }
    }, [triggerBeacon]);

    // Custom crosshair layer for programmatic display
    const ProgrammaticCrosshairLayer = useCallback(
      ({ xScale, innerHeight }: any) => {
        if (programmaticCrosshairX === null) return null;

        const x = xScale(programmaticCrosshairX);

        return (
          <line
            x1={x}
            x2={x}
            y1={0}
            y2={innerHeight}
            stroke={colorMode === 'dark' ? '#fff' : '#000'}
            strokeWidth={1}
            strokeOpacity={0.5}
            strokeDasharray="1, 4"
            style={{ pointerEvents: 'none' }}
          />
        );
      },
      [programmaticCrosshairX, colorMode]
    );

    // layers
    const { AreaLayer, CustomLineLayer, EpochLayer, BeaconLayer, LoadingLayer } = useLayers({
      chartSettings,
      startDate,
      endDate,
      colorMode,
      initialDaysSinceGenesis,
      getDaysFromStartDate,
      isLoading,
      latestPrice,
      triggerBeacon,
      animationEnabled
    });

    const mouseXToDate = useCallback(
      (mouseX: number): Date => {
        const container = chartContainerRef.current;
        if (!container) return startDate;

        const rect = container.getBoundingClientRect();
        const chartWidth = rect.width - 45; // Account for left margin (40px + 1px)
        const relativeX = mouseX - rect.left - 45; // Subtract left margin
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

    const lastAppliedYTickValues = useRef<number[] | number>([]);
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

        lastAppliedYTickValues.current = filtered;
      } else {
        lastAppliedYTickValues.current = 5;
      }
      return lastAppliedYTickValues.current;
    }, [
      chartSettings.useYLog,
      lowestPriceInData,
      middleLogValues,
      highestPriceInData,
      mobileZoomPanMode
    ]);

    const xAxisTickValues = useMemo(() => {
      let allValues: number[] = [];
      if (chartSettings.useXLog) {
        // get d3 x axis scale and get 6 values
        const logXValues = scale.scaleLog().domain([minX, maxX]).ticks(6);
        allValues = [minX, ...logXValues, maxX];
      } else {
        const linearXValues = scale.scaleLinear().domain([minX, maxX]).ticks(6);
        allValues = [minX, ...linearXValues, maxX];
      }
      // Remove duplicates and values that are too close
      // Use a percentage of the domain range to determine minimum spacing
      const domainRange = maxX - minX;
      const minSpacingPercent = 0.05; // 5% of domain range

      const filtered: number[] = [];

      for (let i = 0; i < allValues.length; i++) {
        const value = allValues[i];

        // Always keep the first value
        if (i === 0) {
          filtered.push(value);
          continue;
        }

        // For the last value (maxX), always include it
        if (i === allValues.length - 1) {
          const lastFiltered = filtered[filtered.length - 1];
          // If too close to the previous value, replace it instead of adding
          if (value - lastFiltered < domainRange * minSpacingPercent) {
            filtered[filtered.length - 1] = value;
          } else {
            filtered.push(value);
          }
          continue;
        }

        // For middle values, check spacing from previous filtered value
        const lastFiltered = filtered[filtered.length - 1];
        if (value - lastFiltered >= domainRange * minSpacingPercent) {
          filtered.push(value);
        }
      }
      // dedupe
      return [...new Set(filtered)];
    }, [minX, maxX, chartSettings.useXLog]);

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

    const handleMouseEnter = () => {
      setProgrammaticCrosshairX(null);
    };

    return (
      <Box
        height={'calc(100vh - 200px)'}
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
        onMouseEnter={handleMouseEnter}
        ref={chartContainerRef}
      >
        <div ref={innerDivRef} style={{ position: 'relative', height: '100%', width: '100%' }}>
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
              legendPosition: 'middle',
              tickValues: xAxisTickValues
            }}
            gridXValues={xAxisTickValues}
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
            sliceTooltip={
              mobileZoomPanMode
                ? undefined
                : ({ slice, axis }) => (
                    <SliceTooltip
                      slice={slice}
                      axis={axis}
                      chartSettings={chartSettings}
                      ref={tooltipRef}
                    />
                  )
            }
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
              ...(isLoading || !highestPriceInData ? [] : ['axes' as any]),
              'crosshair',
              ProgrammaticCrosshairLayer,
              CustomLineLayer,
              BeaconLayer,
              'markers',
              'legends',
              'slices',
              LoadingLayer,
              'mesh'
            ]}
          />
        </div>
      </Box>
    );
  }
);

export default PowerLawChart;
