import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import debounce from 'lodash/debounce';
import dayjs from 'dayjs';

export const useTouchEvents = (
  chartContainerRef: React.RefObject<HTMLDivElement>,
  mobileZoomPanMode: boolean,
  setIsScrolling: React.Dispatch<React.SetStateAction<boolean>>,
  startDateRef: React.RefObject<Date>,
  endDateRef: React.RefObject<Date>,
  setStartDate: React.Dispatch<React.SetStateAction<Date>>,
  setEndDate: React.Dispatch<React.SetStateAction<Date>>,
  onDateRangeAdjustedRef: React.RefObject<(startDate: string, endDate: string) => void>
) => {
  const lastTouchDistanceRef = useRef<number | null>(null);
  const lastTouchCenterRef = useRef<number | null>(null);
  const lastAppliedDistanceRef = useRef<number | null>(null);
  const lastAppliedCenterRef = useRef<number | null>(null);

  const debouncedZoomEnd = useMemo(
    () =>
      debounce(() => {
        lastTouchDistanceRef.current = null;
        lastTouchCenterRef.current = null;
        setIsScrolling(false);
      }, 150),
    [setIsScrolling]
  );

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!mobileZoomPanMode) return;

      // Prevent default pinch-zoom behavior and stop propagation
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const touch1 = e.touches[0];

      if (e.touches.length === 2) {
        // Two-finger zoom + pan
        const touch2 = e.touches[1];
        const distance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        const center = (touch1.clientX + touch2.clientX) / 2;
        lastTouchDistanceRef.current = distance;
        lastTouchCenterRef.current = center;
        lastAppliedDistanceRef.current = distance;
        lastAppliedCenterRef.current = center;
      } else if (e.touches.length === 1) {
        // Single-finger pan
        const center = touch1.clientX;
        lastTouchDistanceRef.current = null;
        lastTouchCenterRef.current = center;
        lastAppliedDistanceRef.current = null;
        lastAppliedCenterRef.current = center;
      }
    },
    [mobileZoomPanMode]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!mobileZoomPanMode) return;
      if (lastTouchCenterRef.current === null) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const touch1 = e.touches[0];
      const mode = e.touches.length === 2 ? 'zoom' : 'pan';

      setIsScrolling(true);

      const currentStartDate = startDateRef.current ?? new Date();
      const currentEndDate = endDateRef.current ?? new Date();
      const dateRange = currentEndDate.getTime() - currentStartDate.getTime();

      let newStartDate: Date, newEndDate: Date;

      if (mode === 'pan') {
        // Single-finger pan only
        const center = touch1.clientX;
        const lastCenter = lastAppliedCenterRef.current || lastTouchCenterRef.current;

        // Check for minimum movement
        const centerChange = Math.abs(center - lastCenter);
        if (centerChange < 5) {
          setIsScrolling(false);
          return;
        }

        const actualCenterChange = center - lastCenter;

        // Apply panning
        const container = chartContainerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          const chartWidth = rect.width - 41;
          const panRatio = -actualCenterChange / chartWidth;
          const panAmount = dateRange * panRatio;

          newStartDate = new Date(currentStartDate.getTime() + panAmount);
          newEndDate = new Date(currentEndDate.getTime() + panAmount);
        } else {
          return;
        }

        lastTouchCenterRef.current = center;
        lastAppliedCenterRef.current = center;
      } else {
        // Two-finger zoom + pan
        if (lastTouchDistanceRef.current === null) return;

        const touch2 = e.touches[1];
        const distance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        const center = (touch1.clientX + touch2.clientX) / 2;

        const lastDistance = lastAppliedDistanceRef.current || lastTouchDistanceRef.current;
        const lastCenter = lastAppliedCenterRef.current || lastTouchCenterRef.current;

        // Check for minimum movement
        const distanceChange = Math.abs(distance - lastDistance);
        const centerChange = Math.abs(center - lastCenter);

        if (distanceChange < 10 && centerChange < 5) {
          setIsScrolling(false);
          return;
        }

        // Calculate zoom based on pinch distance ratio
        const distanceRatio = distance / lastDistance;
        const actualCenterChange = center - lastCenter;

        // Apply zoom
        const midPoint = new Date(currentStartDate.getTime() + dateRange / 2);
        const zoomAmount = (distanceRatio - 1) * 0.5; // Dampen zoom sensitivity
        const dampedRatio = 1 + zoomAmount;
        const zoomFactor = 1 / dampedRatio;
        const newRange = dateRange * zoomFactor;

        newStartDate = new Date(midPoint.getTime() - newRange / 2);
        newEndDate = new Date(midPoint.getTime() + newRange / 2);

        // Apply panning
        const container = chartContainerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          const chartWidth = rect.width - 41;
          const panRatio = -actualCenterChange / chartWidth;
          const panAmount = newRange * panRatio;

          newStartDate = new Date(newStartDate.getTime() + panAmount);
          newEndDate = new Date(newEndDate.getTime() + panAmount);
        }

        lastTouchDistanceRef.current = distance;
        lastTouchCenterRef.current = center;
        lastAppliedDistanceRef.current = distance;
        lastAppliedCenterRef.current = center;
      }

      // Prevent going before genesis
      if (newStartDate <= new Date(2009, 1, 3)) {
        debouncedZoomEnd();
        return;
      }

      setStartDate(newStartDate);
      setEndDate(newEndDate);
      if (onDateRangeAdjustedRef.current) {
        onDateRangeAdjustedRef.current(
          dayjs(newStartDate).format('YYYY-MM-DD'),
          dayjs(newEndDate).format('YYYY-MM-DD')
        );
      }

      debouncedZoomEnd();
    },
    [
      debouncedZoomEnd,
      mobileZoomPanMode,
      setIsScrolling,
      startDateRef,
      endDateRef,
      setStartDate,
      setEndDate,
      onDateRangeAdjustedRef,
      chartContainerRef
    ]
  );

  const handleTouchEnd = useCallback(() => {
    lastTouchDistanceRef.current = null;
    lastTouchCenterRef.current = null;
    debouncedZoomEnd();
  }, [debouncedZoomEnd]);

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  };
};

export const useMouseEvents = (
  chartContainerRef: React.RefObject<HTMLDivElement>,
  mouseXToDate: (mouseX: number) => Date,
  setStartDate: React.Dispatch<React.SetStateAction<Date>>,
  setEndDate: React.Dispatch<React.SetStateAction<Date>>,
  onDateRangeAdjusted: (startDate: string, endDate: string) => void,
  setIsScrolling: React.Dispatch<React.SetStateAction<boolean>>,
  startDate: Date,
  endDate: Date
) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; date: Date } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ x: number; date: Date } | null>(null);
  const lastDeltaXRef = useRef<number | null>(null);
  const lastDeltaYRef = useRef<number | null>(null);

  const debouncedZoomEnd = useMemo(
    () =>
      debounce(() => {
        setIsScrolling(false);
        lastDeltaXRef.current = null;
        lastDeltaYRef.current = null;
      }, 150),
    [setIsScrolling]
  );

  const handleScroll = useCallback(
    (e: WheelEvent) => {
      if (isDragging) return;

      e.preventDefault();
      e.stopPropagation();

      const zoomFactor = -0.15;
      const deltaY = e.deltaY;
      const deltaX = e.deltaX;

      if (
        (lastDeltaYRef.current !== null &&
          Math.sign(deltaY) !== Math.sign(lastDeltaYRef.current)) ||
        (lastDeltaXRef.current !== null && Math.sign(deltaX) !== Math.sign(lastDeltaXRef.current))
      ) {
        return;
      }

      lastDeltaXRef.current = deltaX;
      lastDeltaYRef.current = deltaY;

      setIsScrolling(true);

      const dateRange = endDate.getTime() - startDate.getTime();
      const midPoint = new Date(startDate.getTime() + dateRange / 2);

      let newStartDate: Date, newEndDate: Date;

      if (deltaY > 0) {
        const newRange = dateRange * (1 - zoomFactor);
        newStartDate = new Date(midPoint.getTime() - newRange / 2);
        newEndDate = new Date(midPoint.getTime() + newRange / 2);
      } else if (deltaY < 0) {
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
        return;
      }

      setStartDate(newStartDate);
      setEndDate(newEndDate);
      onDateRangeAdjusted(
        dayjs(newStartDate).format('YYYY-MM-DD'),
        dayjs(newEndDate).format('YYYY-MM-DD')
      );
      debouncedZoomEnd();
    },
    [
      isDragging,
      endDate,
      startDate,
      onDateRangeAdjusted,
      debouncedZoomEnd,
      setIsScrolling,
      setStartDate,
      setEndDate
    ]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;

      const date = mouseXToDate(e.clientX);
      const container = chartContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;

      setIsDragging(true);
      setDragStart({ x, date });
      setDragEnd({ x, date });

      e.preventDefault();
    },
    [mouseXToDate, chartContainerRef]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !dragStart) return;

      const date = mouseXToDate(e.clientX);
      const container = chartContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;

      setDragEnd({ x, date });
    },
    [isDragging, dragStart, mouseXToDate, chartContainerRef]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDragging || !dragStart || !dragEnd) {
      setIsDragging(false);
      setDragStart(null);
      setDragEnd(null);
      return;
    }

    const startDateForRange = dragStart.date < dragEnd.date ? dragStart.date : dragEnd.date;
    const endDateForRange = dragStart.date < dragEnd.date ? dragEnd.date : dragStart.date;

    const daysDiff = Math.abs(dayjs(endDateForRange).diff(startDateForRange, 'day'));
    if (daysDiff > 30) {
      setStartDate(startDateForRange);
      setEndDate(endDateForRange);
      onDateRangeAdjusted(
        dayjs(startDateForRange).format('YYYY-MM-DD'),
        dayjs(endDateForRange).format('YYYY-MM-DD')
      );
    }

    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  }, [isDragging, dragStart, dragEnd, onDateRangeAdjusted, setStartDate, setEndDate]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleMouseUp();
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDragging, handleMouseUp]);

  return {
    isDragging,
    dragStart,
    dragEnd,
    handleScroll,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp
  };
};
