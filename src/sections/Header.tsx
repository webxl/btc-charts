import { useColorMode } from '@chakra-ui/system';
import { Heading, HStack, IconButton } from '@chakra-ui/react';
import { appName } from '../const.ts';
import { MoonIcon, SunIcon } from '@chakra-ui/icons';

export const Header = () => {
  const { colorMode, toggleColorMode } = useColorMode();

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
      <HStack>
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
