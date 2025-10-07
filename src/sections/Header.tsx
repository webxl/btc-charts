import { useColorMode } from '@chakra-ui/system';
import { Heading, HStack, IconButton, Box, Text } from '@chakra-ui/react';
import { appName } from '../const.ts';
import { MoonIcon, SunIcon } from '@chakra-ui/icons';
import { useEffect, useState } from 'react';
import { fetchLatestPrice } from '../fetch.ts';
import { formatCurrency } from '../utils.ts';
import { darkPriceColor } from '../const.ts';
import { Download } from 'react-feather';

interface HeaderProps {
  onInstall?: () => void;
}

export const Header = ({ onInstall }: HeaderProps) => {
  const { colorMode, toggleColorMode } = useColorMode();

  const [latestPrice, setLatestPrice] = useState(0);

  useEffect(() => {
    fetchLatestPrice().then(setLatestPrice);
    const interval = setInterval(() => {
      fetchLatestPrice().then(setLatestPrice);
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <HStack
      w={'100%'}
      backgroundColor={colorMode === 'light' ? 'white' : 'gray.800'}
      borderBottom={`1px solid`}
      borderBottomColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
      justifyContent={'space-between'}
      height={'50px'}
      px={5}
      position={'fixed'}
      top={0}
      zIndex={2}
    >
      <Heading size={'lg'} as={'h1'} fontWeight={400}>
        {appName}
      </Heading>
      <Box> 
        <Text color={colorMode === 'light' ? 'blue' : darkPriceColor} opacity={latestPrice === 0 ? 0 : 1} transition="opacity 0.5s ease-in-out" filter=
        {`drop-shadow(0px 0px ${colorMode === 'dark' ? ' 3px rgba(255, 255, 255, 0.6)':  ' 1px #66e264'})`}>{formatCurrency(latestPrice)}</Text>
    
      </Box>
      <HStack>
        {onInstall && (
          <IconButton
            aria-label="Add to Home Screen"
            icon={<Download size={18} />}
            onClick={onInstall}
            variant={'ghost'}
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
