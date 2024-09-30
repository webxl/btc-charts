import { Button, FormControl, HStack, VStack } from '@chakra-ui/react';
import { Label } from '../sections/parameters/inputs';
import { useCallback } from 'react';

export type ChartSettings = {
  useXLog: boolean;
  useYLog: boolean;
  showPowerLawPlot: boolean;
  showOuterBand: boolean;
  showInnerBand: boolean;
  showPricePlot: boolean;
};

const ChartControls = ({
  chartSettings,
  onChartSettingsChange
}: {
  chartSettings: ChartSettings;
  onChartSettingsChange: (settings: ChartSettings) => void;
}) => {

  const toggleSetting = useCallback((key: keyof ChartSettings) => {
    const newSettings = { ...chartSettings, [key]: !chartSettings[key] };
    if (key === 'showPowerLawPlot' && !newSettings.showPowerLawPlot) {
      newSettings.showOuterBand = false;
      newSettings.showInnerBand = false;
    }
    onChartSettingsChange(newSettings);
  }, [chartSettings, onChartSettingsChange]);

  return <VStack alignItems={'flex-start'}>
    <HStack>
      <FormControl  flexGrow={1}>
        <Label label='Y Axis:' />
      <Button onClick={() => toggleSetting('useYLog')}>{chartSettings.useYLog ? 'Log' : 'Linear'}</Button>{' '}
    </FormControl>
    <FormControl flexGrow={1} w={'100%'}>
      <Label label='X Axis:' />
      <Button onClick={() => toggleSetting('useXLog')}> {chartSettings.useXLog ? 'Log' : 'Linear'}</Button>
    </FormControl>
    </HStack>
    <FormControl>
      <Label label='Power Law' />
      <Button onClick={() => toggleSetting('showPowerLawPlot')}>
        {chartSettings.showPowerLawPlot ? 'Hide' : 'Show'}
      </Button>
    </FormControl>
    { chartSettings.showPowerLawPlot && (<>
    <FormControl>
      <Label label='Deviation Bands' />
      <HStack>
        <Button onClick={() => toggleSetting('showOuterBand')}>
          {chartSettings.showOuterBand ? 'Hide' : 'Show'} Outer
        </Button>
        <Button onClick={() => toggleSetting('showInnerBand')}>
          {chartSettings.showInnerBand ? 'Hide' : 'Show'} Inner
        </Button>
        </HStack>
      </FormControl>
    <FormControl>
      <Label label='Price' />
      <Button onClick={() => toggleSetting('showPricePlot')}>
        {chartSettings.showPricePlot ? 'Hide' : 'Show'}
      </Button>
    </FormControl></>
    )}
  </VStack>
};

export default ChartControls;
