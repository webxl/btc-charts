import { Button, Divider, VStack } from '@chakra-ui/react';
import { useCallback, useEffect, useReducer } from 'react';
import { AnalysisFormData } from '../../calc.ts';
import { DateInput } from './inputs.tsx';
import parametersReducer from './reducer.ts';
import dayjs from 'dayjs';
import { PeriodSelector } from './PeriodSelector.tsx';
import ChartControls, { ChartSettings } from '../../charts/ChartControls.tsx';

const Parameters = ({
  isLoading,
  onChange,
  onChartSettingsChange,
  parameters,
  chartSettings,
  onDrawerClose,
  resetToDefaults
}: {
  onChange: (params: AnalysisFormData) => void;
  onChartSettingsChange: (settings: ChartSettings) => void;
  parameters: AnalysisFormData;
  chartSettings: ChartSettings;
  onDrawerClose?: (() => void) | undefined;
  resetToDefaults: () => void;
  isLoading: boolean;
}) => {
  const [state, dispatch] = useReducer(parametersReducer, {
    ...parameters,
    overrides: {},
    isDirty: false,
    chartSettings
  });

  const handleAnalysisStartChange = useCallback((startDate: string | number) => {
    dispatch({ type: 'analysisStart', value: startDate, isDirty: true, setOverride: false });
  }, []);

  const handleAnalysisEndChange = useCallback((endDate: string | number) => {
    dispatch({ type: 'analysisEnd', value: endDate, isDirty: true, setOverride: false });
  }, []);

  const handleChartSettingsChange = useCallback((settings: ChartSettings) => {
    dispatch({ type: 'chartSettings', value: settings, isDirty: true, setOverride: false });
    onChartSettingsChange(settings);
  }, [onChartSettingsChange]);

  const _resetToDefaults = useCallback(() => {
    resetToDefaults();
  }, [resetToDefaults]);

  useEffect(() => {
    if (state.isDirty) {
      onChange(state);
      dispatch({ type: 'isDirty', value: false });
    }
  }, [onChange, state]);

  useEffect(() => {
    if (!state.isDirty) {
      if (dayjs(parameters.analysisStart).format('L') !== dayjs(state.analysisStart).format('L')) {
        dispatch({ type: 'analysisStart', value: parameters.analysisStart, setOverride: true });
      }
      if (dayjs(parameters.analysisEnd).format('L') !== dayjs(state.analysisEnd).format('L')) {
        dispatch({ type: 'analysisEnd', value: parameters.analysisEnd, setOverride: true });
      }
      if (JSON.stringify(chartSettings) !== JSON.stringify(state.chartSettings)) {  
        dispatch({ type: 'chartSettings', value: chartSettings, setOverride: true });
      }
    }
  }, [parameters.analysisEnd, parameters.analysisStart, chartSettings, state]);

  const handlePeriodChange = useCallback((period: number) => {
    const endDate = dayjs().format('YYYY-MM-DD');
    const startDate = period === Infinity ? '2010-07-18' : dayjs(endDate).subtract(period, 'year').format('YYYY-MM-DD');
    dispatch({ type: 'analysisStart', value: startDate, isDirty: true, setOverride: true });
    dispatch({ type: 'analysisEnd', value: endDate, isDirty: true, setOverride: true });
  }, []);

  return (
    <VStack alignItems={'flex-start'} minW={180}>

      <DateInput
        label={'Analysis Start Date'}
        value={state.analysisStart}
        onChange={handleAnalysisStartChange}
        min={'2009-01-03'}
        max={state.analysisEnd}
        useOverride={state.overrides.analysisStart}
        isDisabled={isLoading}
      />

      <DateInput
        label={'Analysis End Date'}
        value={state.analysisEnd}
        onChange={handleAnalysisEndChange}
        min={state.analysisStart}
        max={'2999-12-31'}
        useOverride={state.overrides.analysisEnd}
        isDisabled={isLoading}
      />

      <PeriodSelector
        onChange={handlePeriodChange}
        analysisStart={state.analysisStart}
        analysisEnd={state.analysisEnd}
        isDisabled={isLoading}
      />

      {onDrawerClose && (
        <Button onClick={onDrawerClose} aria-label={'Apply'} alignSelf={'center'}>
          Apply
        </Button>
      )}
      <Divider my={4} />
      <ChartControls chartSettings={state.chartSettings} onChartSettingsChange={handleChartSettingsChange} isLoading={isLoading} />
      <Divider my={4} />

      <Button variant={'link'} onClick={_resetToDefaults} >
        Reset to defaults
      </Button>
    </VStack>
  );
};

export default Parameters;
