import Parameters from './sections/parameters/index.tsx';

import {
  Box,
  Button,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  HStack,
  Link,
  Text,
  useBreakpointValue,
  useDisclosure,
  VStack
} from '@chakra-ui/react';
import { Icon } from '@chakra-ui/icons';
import { AnalysisFormData } from './calc.ts';
import { useCallback, useEffect, useState } from 'react';
import dayjs from 'dayjs';
import LocalizedFormat from 'dayjs/plugin/localizedFormat';
import { useColorMode } from '@chakra-ui/system';
import { GitHub, Sliders } from 'react-feather';
import { Header } from './sections/Header.tsx';
import PowerLawChart from './charts/PowerLaw.tsx';
import { DailyPriceDatum } from './calc.ts';
import { ChartSettings } from './charts/ChartControls.tsx';

dayjs.extend(LocalizedFormat);

const initialState = {
  analysisStart: '2010-07-18',
  analysisEnd: dayjs().format('YYYY-MM-DD')
};

const initialChartSettings = {
  useXLog: false,
  useYLog: false,
  showPowerLawPlot: false,
  showOuterBand: false,
  showInnerBand: false,
  showPricePlot: true
};
function App() {
  const [dailyPriceData, setdailyPriceData] = useState<DailyPriceDatum[]>([]);

  const [parameters, setParameters] = useState<AnalysisFormData>(() => {
    const savedState = localStorage.getItem('parameters');
    return savedState ? (JSON.parse(savedState) as AnalysisFormData) : initialState;
  });
  const [chartSettings, setChartSettings] = useState<ChartSettings>(() => {
    const savedState = localStorage.getItem('chartSettings');
    return savedState ? (JSON.parse(savedState) as ChartSettings) : initialChartSettings;
  });
  const { colorMode } = useColorMode();

  useEffect(() => {
    const fetchData = async () => {
      return fetch('/api/timeseries').then(r => r.json());
    };

    if (!dailyPriceData.length) {
      fetchData()
        .then(data => setdailyPriceData(data as DailyPriceDatum[]))
        // eslint-disable-next-line no-console
        .catch(e => console.error(e));
    }
  }, [dailyPriceData]);

  const breakpointValue = useBreakpointValue({
    base: 'base',
    md: 'md'
  });

  useEffect(() => {
    localStorage.setItem('parameters', JSON.stringify(parameters));
  }, [parameters]);

  const handleParameterUpdate = useCallback((formData: AnalysisFormData) => {
    setParameters({ ...formData });
  }, []);

  const handleChartSettingsChange = useCallback((settings: ChartSettings) => {
    localStorage.setItem('chartSettings', JSON.stringify(settings));
    setChartSettings(settings);
  }, []);

  useEffect(() => {
    const savedState = localStorage.getItem('parameters');
    handleParameterUpdate(savedState ? (JSON.parse(savedState) as AnalysisFormData) : initialState);
  }, [handleParameterUpdate]);

  const resetToDefaults = useCallback(() => {
    localStorage.setItem('parameters', JSON.stringify(initialState));
    handleParameterUpdate({ ...initialState });
    localStorage.setItem('chartSettings', JSON.stringify(initialChartSettings));
    setChartSettings(initialChartSettings);
  }, [handleParameterUpdate]);

  const {
    isOpen: isDrawerOpen,
    onOpen: setDrawerOpen,
    onClose: setDrawerClosed
  } = useDisclosure({ defaultIsOpen: breakpointValue === 'base' });

  const onDateRangeAdjusted = useCallback(
    (startDate: string, endDate: string) => {
      handleParameterUpdate({ analysisStart: startDate, analysisEnd: endDate });
    },
    [handleParameterUpdate]
  );

  const parametersSection = (
    <Parameters
      onChange={handleParameterUpdate}
      onChartSettingsChange={handleChartSettingsChange}
      parameters={parameters}
      chartSettings={chartSettings}
      onDrawerClose={breakpointValue === 'base' ? setDrawerClosed : undefined}
      resetToDefaults={resetToDefaults}
    />
  );

  return (
    <>
      <Header
      />
      {dailyPriceData.length && breakpointValue === 'base' && (
        <HStack justifyContent={'space-between'} w={'100%'} mt={'55px'}>
          <Button onClick={setDrawerOpen} variant={'ghost'} alignSelf={'center'}>
            <Icon as={Sliders} mr={1} /> Parameters
          </Button>
          <Drawer isOpen={isDrawerOpen} onClose={setDrawerClosed} placement="left">
            <DrawerOverlay />
            <DrawerContent>
              <DrawerCloseButton />
              <DrawerHeader>Adjustments</DrawerHeader>
              <DrawerBody>{parametersSection}</DrawerBody>
            </DrawerContent>
          </Drawer>
        </HStack>
      )}
      {dailyPriceData.length && (
        <HStack
          alignItems={'stretch'}
          justifyItems={'stretch'}
          p={0}
          gap={0}
          mt={breakpointValue !== 'base' ? '50px' : 0}
          height={'100%'}
        >
          {breakpointValue !== 'base' && (
            <Box
              backgroundColor={colorMode === 'light' ? 'gray.50' : 'gray.700'}
              borderRight={`1px solid ${colorMode === 'light' ? '#eee' : '#555'}`}
              w={'300px'}
              minHeight={'calc(100vh - 50px)'}
              px={5}
              pt={2}
            >
              {parametersSection}
            </Box>
          )}
          <VStack
            alignItems={'stretch'}
            flexGrow={1}
            minW={0}
            p={0}
            position={'relative'}
            w={'100%'}
            overflowY={'auto'}
          >
            <Box mt={0} px={2} pt={14}>
              <PowerLawChart
                dailyPriceData={dailyPriceData}
                parameters={parameters}
                onDateRangeAdjusted={onDateRangeAdjusted}
                chartSettings={chartSettings}
              />{' '}
              <VStack mt={14} w={'100%'} alignContent={'center'} gap={10}>
                <Text fontSize={'xs'} maxW={760} textAlign={'center'} color={'gray.500'}>
                  This tool is for illustrative purposes only. It is not intended to provide
                  investment advice or financial planning services. The results are based on the
                  information you provide and are not guaranteed. Actual results will definitely
                  vary. Please consult a qualified professional for personalized advice, or just buy
                  some{' '}
                  <Link isExternal href={'https://www.swanbitcoin.com/motherway'}>
                    ₿itcoin
                  </Link>
                  .
                </Text>
                <HStack maxW={760} justifyContent={'center'} alignItems={'flex-start'}>
                  <Link fontSize={'xs'} color={'gray.500'} isExternal href={'https://webxl.net'}>
                    webXL
                  </Link>
                  <Link
                    color={'gray.500'}
                    isExternal
                    href={'https://github.com/webxl/btc-charts'}
                  >
                    {' '}
                    <Icon as={GitHub} />{' '}
                  </Link>
                </HStack>
              </VStack>
            </Box>
          </VStack>
        </HStack>
      )}
    </>
  );
}

export default App;
