import { Box, Button,  HStack } from '@chakra-ui/react';
import { useCallback, useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { Label } from './inputs';

export const PeriodSelector = ({
  onChange,
  analysisStart,
  analysisEnd,
  isDisabled
}: {
  onChange: (period: number) => void;
  analysisStart: string;
  analysisEnd: string;
  isDisabled: boolean;
}) => {
  const periods = [1, 5, 10, Infinity];
  const [selectedPeriod, setSelectedPeriod] = useState(1);
  const handlePeriodChange = useCallback((period: number) => {
    onChange(period);
  }, [onChange]);

  useEffect(() => {
    if (analysisStart && analysisEnd) {
      const period = dayjs(analysisEnd).diff(analysisStart, 'year');
      setSelectedPeriod(period);
    }
  }, [analysisStart, analysisEnd, onChange]);

  return (
    <Box>
      <Label label={'Period'} />
      <HStack>
        {periods.map((period) => (
        <Button key={period} onClick={() => handlePeriodChange(period)} variant={selectedPeriod === period ? 'solid' : 'outline'} isDisabled={isDisabled}>
          {period !== Infinity ? `${period}y` : 'All'}
        </Button>
        ))}
      </HStack>
    </Box>
  );
};
