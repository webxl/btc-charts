import { Button, FormControl, HStack, VStack } from '@chakra-ui/react';
import { Label } from '../sections/parameters/inputs';
import { useCallback } from 'react';
import { powerLawIntercept, powerLawSlope } from '../const';

export type ChartSettings = {
  useXLog: boolean;
  useYLog: boolean;
  showPowerLawPlot: boolean;
  showOuterBand: boolean;
  showInnerBand: boolean;
  showPricePlot: boolean;
  showHalvingEpochs: boolean;
};

const ChartControls = ({
  chartSettings,
  onChartSettingsChange,
  isLoading
}: {
  chartSettings: ChartSettings;
  onChartSettingsChange: (settings: ChartSettings) => void;
  isLoading: boolean;
}) => {
  const toggleSetting = useCallback(
    (key: keyof ChartSettings) => {
      const newSettings = { ...chartSettings, [key]: !chartSettings[key] };
      if (key === 'showPowerLawPlot' && !newSettings.showPowerLawPlot) {
        newSettings.showOuterBand = false;
        newSettings.showInnerBand = false;
      }
      onChartSettingsChange(newSettings);
    },
    [chartSettings, onChartSettingsChange]
  );

  return (
    <VStack alignItems={'flex-start'}>
      <HStack>
        <FormControl flexGrow={1}>
          <Label label="Y Axis:" />
          <Button onClick={() => toggleSetting('useYLog')} isDisabled={isLoading}>
            {chartSettings.useYLog ? 'Log' : 'Linear'}
          </Button>{' '}
        </FormControl>
        <FormControl flexGrow={1} w={'100%'}>
          <Label label="X Axis:" />
          <Button onClick={() => toggleSetting('useXLog')} isDisabled={isLoading}>
            {' '}
            {chartSettings.useXLog ? 'Log' : 'Linear'}
          </Button>
        </FormControl>
      </HStack>
      <FormControl>
        <Label
          label="Power Law"
          tooltip={
            <>
              Toggles the power law plot. When enabled, a power law regression line is plotted using{' '}
              <code style={{ fontSize: '12px' }}>{powerLawIntercept}</code> for the intercept
              coefficient (a) and <code style={{ fontSize: '12px' }}>{powerLawSlope}</code> for the
              slope coefficient (b).
            </>
          }
        />
        <Button onClick={() => toggleSetting('showPowerLawPlot')} isDisabled={isLoading}>
          {chartSettings.showPowerLawPlot ? 'Hide' : 'Show'}
        </Button>
      </FormControl>
      {chartSettings.showPowerLawPlot && (
        <>
          <FormControl>
            <Label label="Deviation Bands" />
            <HStack>
              <Button onClick={() => toggleSetting('showInnerBand')} isDisabled={isLoading}>
                {chartSettings.showInnerBand ? 'Hide' : 'Show'} Inner
              </Button>
              <Button onClick={() => toggleSetting('showOuterBand')} isDisabled={isLoading}>
                {chartSettings.showOuterBand ? 'Hide' : 'Show'} Outer
              </Button>
            </HStack>
          </FormControl>
          <FormControl>
            <Label label="Price" />
            <Button onClick={() => toggleSetting('showPricePlot')} isDisabled={isLoading}>
              {chartSettings.showPricePlot ? 'Hide' : 'Show'}
            </Button>
          </FormControl>
          <FormControl>
            <Label label="Halving Epochs" />
            <Button onClick={() => toggleSetting('showHalvingEpochs')} isDisabled={isLoading}>
              {chartSettings.showHalvingEpochs ? 'Hide' : 'Show'}
            </Button>
          </FormControl>
        </>
      )}
    </VStack>
  );
};

export default ChartControls;
