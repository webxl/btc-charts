import { useColorMode } from '@chakra-ui/system';
import { Heading, HStack, IconButton, Text, Spinner, Tooltip } from '@chakra-ui/react';
import { appName, powerLawColor } from '../const.ts';
import { MoonIcon, SunIcon } from '@chakra-ui/icons';
import { formatPercentage } from '../utils.ts';
import { darkPriceColor } from '../const.ts';
import { Download } from 'react-feather';
import { getPowerLawDelta } from '../calc.ts';
import { AnimatedPrice } from '../components/AnimatedPrice.tsx';

interface HeaderProps {
  onInstall?: () => void;
  onPriceClick?: () => void;
  showIOSInstall?: boolean;
  isLoading?: boolean;
  latestPrice?: number;
  showPowerLawDelta?: boolean;
}

export const Header = ({ onInstall, onPriceClick, showIOSInstall, isLoading, latestPrice, showPowerLawDelta }: HeaderProps) => {
  const { colorMode, toggleColorMode } = useColorMode();

  return (
    <HStack
      w={'100%'}
      backgroundColor={colorMode === 'light' ? 'white' : 'gray.800'}
      borderBottom={`1px solid`}
      borderBottomColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
      justifyContent={'space-between'}
      height={'50px'}
      px={4}
      position={'fixed'}
      top={0}
      zIndex={2}
    >
      <Heading size={'lg'} as={'h1'} fontWeight={400} whiteSpace={'nowrap'}>
        {appName}
      </Heading>
      <Tooltip label="Click to view latest price in chart">
        <HStack onClick={onPriceClick} cursor="pointer">
          <AnimatedPrice
            price={latestPrice || 0}
            color={colorMode === 'light' ? 'blue' : darkPriceColor}
            colorMode={colorMode}
            opacity={latestPrice === 0 ? 0 : 1}
            transition="opacity 0.5s ease-in-out"
            filter={`drop-shadow(0px 0px ${colorMode === 'dark' ? ' 3px rgba(255, 255, 255, 0.6)' : ' 1px #66e264'})`}
            display='inline'
            showTestButton={true}
          />
        {showPowerLawDelta && (
          <Text
            color={powerLawColor}
            opacity={latestPrice === 0 ? 0 : 1}
            transition="opacity 0.5s ease-in-out"
            filter={`drop-shadow(0px 0px ${colorMode === 'dark' ? ' 3px rgba(255, 255, 255, 0.6)' : ' 0px black'})`}
            display='inline'
            fontSize={'xs'}
          >
            ({formatPercentage(getPowerLawDelta(latestPrice || 0))})
          </Text>
        )}
      </HStack>
      </Tooltip>
      <HStack spacing={0}>
        {onInstall && showIOSInstall && (
          <IconButton
            aria-label="Add to Home Screen"
            icon={<Download size={18} />}
            onClick={onInstall}
            variant={'ghost'}
          />
        )}
          {isLoading && (
            <Spinner
              size="sm"
              color={colorMode === 'light' ? 'blue' : darkPriceColor}
              speed="0.85s"
              thickness="2px"
              opacity={0.8}
            />
          )}
        <IconButton
          aria-label="Toggle Dark Mode"
          icon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
          onClick={toggleColorMode}
          variant={'ghost'}
        />
      </HStack>
    </HStack>
  );
};
