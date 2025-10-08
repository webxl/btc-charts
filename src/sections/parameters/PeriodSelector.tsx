import { Box, Button, Tooltip, HStack } from '@chakra-ui/react';
import { useCallback, useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { Label } from './inputs';
import { Icon } from '@chakra-ui/icons';
import { Check } from 'react-feather';

export const PeriodSelector = ({
  onChange,
  analysisStart,
  analysisEnd,
  dataStart,
  dataEnd,
  isDisabled,
  onDrawerClose
}: {
  onChange: (period: number) => void;
  analysisStart: string;
  analysisEnd: string;
  dataStart?: string;
  dataEnd?: string;
  isDisabled: boolean;
  onDrawerClose?: (() => void) | undefined;
}) => {
  const maxPeriod = dayjs(dataEnd).diff(dataStart, 'year');
  const periods = [1, 5, 10, maxPeriod];
  const [selectedPeriod, setSelectedPeriod] = useState(1);
  const handlePeriodChange = useCallback(
    (period: number) => {
      if (maxPeriod === period) {
        onChange(Infinity);
      } else {
        onChange(period);
      }
    },
    [onChange]
  );

  useEffect(() => {
    if (analysisStart && analysisEnd) {
      const period = dayjs(analysisEnd).diff(analysisStart, 'year');
      setSelectedPeriod(period);
    }
  }, [analysisStart, analysisEnd]);

  return (
    <Box>
      <Label label={'Period'} />
      <HStack spacing={onDrawerClose ? 1 : 2}>
        {periods.map(period => (
          <Tooltip
            key={period}
            label={
              period !== maxPeriod
                ? period === 1
                  ? 'Last year'
                  : ` Last ${period} years`
                : 'All available price data'
            }
          >
            <Button
              onClick={() => handlePeriodChange(period)}
              variant={selectedPeriod === period ? 'solid' : 'outline'}
              isDisabled={isDisabled}
            >
              {period !== maxPeriod ? `${period}y` : 'All'}
            </Button>
          </Tooltip>
        ))}
        {onDrawerClose && (
        <Button variant={'ghost'} onClick={onDrawerClose} aria-label={'Apply'} >
          <Icon as={Check} />
        </Button>
        )}
      </HStack>
    </Box>
  );
};
