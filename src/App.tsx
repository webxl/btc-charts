/* eslint-disable no-console */
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
  Skeleton,
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

const initialState: AnalysisFormData = {
  analysisStart: '2010-07-18',
  analysisEnd: dayjs().format('YYYY-MM-DD'),
  dataStart: '2010-07-18',
  dataEnd: dayjs().format('YYYY-MM-DD')
};

const initialChartSettings = {
  useXLog: false,
  useYLog: false,
  showPowerLawPlot: false,
  showOuterBand: false,
  showInnerBand: false,
  showPricePlot: true
};

const apiUrl = (import.meta.env.VITE_API_URL as string) || '/api';

const fetchData = async (callback: (data: DailyPriceDatum[]) => void) => {
  try {
    const data: DailyPriceDatum[] = await fetch(`${apiUrl}/timeseries`).then(r => {
      if (!r.ok) {
        throw new Error('Invalid network response');
      }
      return r.json() as Promise<DailyPriceDatum[]>;
    }).then(data => {
        let _lastDate = dayjs(data[0].date);
        const _dailyPriceData = [...data];
        for (let i = 0; i < data.length; i++) {
          const currentDate = dayjs(data[i].date);
          const numDays = currentDate.diff(_lastDate, 'day');
          if (numDays > 1) {
            console.log('Missing data between', _lastDate.format('YYYY-MM-DD'), 'and', currentDate.format('YYYY-MM-DD'));
            // fill missing points
            for (let j = 0; j < numDays; j++) {
              _dailyPriceData.splice(i + j, 0, {
                date: _lastDate.add(j + 1, 'day').format('YYYY-MM-DD'),
                price: _dailyPriceData[i].price
              });
            }
          }
          _lastDate = currentDate;
        }

        return _dailyPriceData;
    });
    callback(data);
  } catch (e) {
    console.error(e);
  }
};

function App() {
  const [dailyPriceData, setdailyPriceData] = useState<DailyPriceDatum[]>([]);

  const [parameters, setParameters] = useState<AnalysisFormData>(() => {
    const savedState = localStorage.getItem('parameters');
    const parsedState = {...initialState, ...savedState ? (JSON.parse(savedState) as AnalysisFormData) : {}};
    return parsedState;
  });
  const [chartSettings, setChartSettings] = useState<ChartSettings>(() => {
    const savedState = localStorage.getItem('chartSettings');
    return savedState ? (JSON.parse(savedState) as ChartSettings) : initialChartSettings;
  });
  const { colorMode, toggleColorMode } = useColorMode();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (colorMode === undefined) {
      toggleColorMode();
    }
  }, [colorMode, toggleColorMode]);

  const [retryCount, setRetryCount] = useState(5);

  useEffect(() => {
    fetchData(setdailyPriceData).then(() => setIsLoading(false)).catch(e => console.error(e));
  }, []);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (!dailyPriceData.length && retryCount > 0) {
      setRetryCount(retryCount - 1);

      timeout = setTimeout(() => {
        fetchData(setdailyPriceData).catch(e => console.error(e));
      }, 2000);
    }

    return () => clearTimeout(timeout);

  }, [dailyPriceData, retryCount]);

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
        handleParameterUpdate({ 
          analysisStart: startDate, 
          analysisEnd: endDate,
          dataStart: startDate,
          dataEnd: endDate
        });
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
        isLoading={isLoading}
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
              w={'100%'}
              minW={0}
              p={0}
              position={'relative'}
              overflow={'visible'}
              zIndex={1}
            >
              <VStack mt={0} px={2} pt={5} alignItems={'stretch'} 
              zIndex={1}
              >
                {(isLoading || !dailyPriceData.length )? <Skeleton speed={2} height={400} width={'90%'} alignSelf={'center'} /> : (   
                <PowerLawChart
                  dailyPriceData={dailyPriceData}
                  parameters={parameters}
                  onDateRangeAdjusted={onDateRangeAdjusted}
                    chartSettings={chartSettings}
                  />
                )}
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
              </VStack>
            </VStack>
          </HStack>
      </>
    );
  }

export default App;
