import React, { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { formatCurrency, formatCurrencyWithCents, formatPercentage } from '../../utils.ts';
import {
  Box,
  Checkbox,
  FormControl,
  FormLabel,
  HStack,
  Input,
  InputGroup,
  InputRightElement,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Text,
  Tooltip
} from '@chakra-ui/react';
import { Icon } from '@chakra-ui/icons';
import round from 'lodash/round';
import dayjs from 'dayjs';
import { Check, Info, X } from 'react-feather';
import { useColorMode } from '@chakra-ui/system';

type CommonInputProps = {
  onChange: (val: string | number) => void;
  label: string;
  value: string | number;
  tooltip?: string;
  isDisabled?: boolean;
  highlight?: boolean;
  useOverride?: boolean;
  handleKeepReset?: (isKeeping: boolean) => void;
  min?: string | number;
  max?: string | number;
};

export const DollarAmountInput = ({
  onChange,
  label,
  value,
  step = 1000,
  tooltip,
  isDisabled,
  highlight,
  useOverride,
  handleKeepReset
}: CommonInputProps & {
  step?: number;
}) => {
  return (
    <_Input
      highlight={highlight}
      isDisabled={isDisabled}
      label={label}
      onChange={onChange}
      tooltip={tooltip}
      type={'number'}
      useOverride={useOverride}
      value={value}
      parse={(val: string) => parseFloat(val.replace(/[$,]/g, ''))}
      min={0}
      max={99999999999}
      step={step}
      numberFormatter={highlight ? formatCurrencyWithCents : formatCurrency}
      handleKeepReset={handleKeepReset}
    />
  );
};

export const PercentageAmountInput = ({
  onChange,
  label,
  value,
  tooltip,
  isDisabled,
  highlight,
  useOverride,
  handleKeepReset
}: CommonInputProps) => {
  return (
    <_Input
      highlight={highlight}
      isDisabled={isDisabled}
      label={label}
      onChange={onChange}
      tooltip={tooltip}
      type={'number'}
      useOverride={useOverride}
      value={value}
      parse={(val: string) => round(parseFloat(val.replace(/%/, '')) / 100, 4)}
      min={0}
      max={100}
      step={0.1}
      numberFormatter={(val, isEditing = false) =>
        isEditing ? round(val * 100, 2).toString() : formatPercentage(val)
      }
      handleKeepReset={handleKeepReset}
    />
  );
};

export const DateInput = ({
  label,
  value,
  onChange,
  tooltip,
  isDisabled,
  highlight,
  useOverride,
  handleKeepReset,
  min,
  max
}: CommonInputProps) => {
  return (
    <_Input
      highlight={highlight}
      isDisabled={isDisabled}
      label={label}
      onChange={onChange}
      tooltip={tooltip}
      type={'date'}
      useOverride={useOverride}
      value={value}
      parse={(val: string) => dayjs(val).format('YYYY-MM-DD')}
      handleKeepReset={handleKeepReset}
      min={min}
      max={max}
    />
  );
};

type InternalInputProps = {
  onChange: (val: string | number) => void;
  label: string;
  value: string | number;
  step?: number;
  min?: number | string;
  max?: number | string;
  tooltip?: string;
  isDisabled?: boolean;
  highlight?: boolean;
  useOverride?: boolean;
  type: 'date' | 'number';
  parse?: (val: string) => number | string;
  numberFormatter?: (val: number, isEditing?: boolean) => string;
  formatter?: (val: string) => string;
  handleKeepReset?: (isKeeping: boolean) => void;
};

const _Input = ({
  highlight,
  isDisabled,
  label,
  onChange,
  tooltip,
  type,
  useOverride,
  value,
  parse,
  numberFormatter,
  min,
  max,
  step = 1000,
  handleKeepReset
}: InternalInputProps) => {
  const colorMode = useColorMode();
  const [formattedAmount, setFormattedAmount] = useState(() =>
    type === 'number' && numberFormatter ? numberFormatter(value as number) : value
  );
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [externallySetValue, setExternallySetValue] = useState(value);

  const _onChange = useCallback(
    (val: string) => {
      setFormattedAmount(val);
      onChange(parse ? parse(val) : val);
    },
    [onChange, parse]
  );

  useEffect(() => {
    if (highlight || useOverride) {
      setFormattedAmount(
        type === 'number' && numberFormatter ? numberFormatter(value as number) : value
      );
      setExternallySetValue(value);
    }
  }, [highlight, useOverride, value, type, numberFormatter]);

  const handleBlur = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(
      () => setFormattedAmount(numberFormatter ? numberFormatter(value as number) : value),
      200
    );
  }, [value, numberFormatter]);

  const handleDateChangeEvent = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.value) {
        return;
      }
      const dayValue = dayjs(e.target.value);
      setExternallySetValue(e.target.value);
      if (dayValue < dayjs(min) || dayValue > dayjs(max)) {
        e.preventDefault();
        return true;
      }
      setFormattedAmount(dayValue.format('YYYY-MM-DD'));
      onChange(dayValue.format('YYYY-MM-DD'));
    },
    [min, max]
  );

  const handleDateBlur = useCallback(() => {
    onChange(dayjs(formattedAmount).format('YYYY-MM-DD'));
  }, [formattedAmount, onChange]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value]);

  const handleFocus = useCallback(() => {
    if (!highlight)
      setFormattedAmount(numberFormatter ? numberFormatter(value as number, true) : value);
  }, [highlight, value, numberFormatter]);

  const handleClear = useCallback(() => {
    setFormattedAmount(numberFormatter ? numberFormatter(0) : '');
    onChange(0);
  }, [onChange, numberFormatter]);

  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      setExternallySetValue(formattedAmount);
      onChange(dayjs(formattedAmount).format('YYYY-MM-DD'));
    }
  };

  const keepOrReset = highlight ? (
    <div>
      <InputRightElement
        children={<Icon as={Check} w={5} h={5} color={'green'} mr={16} />}
        data-test="input-keep-button"
        onClick={() => handleKeepReset?.(true)}
        zIndex={1}
        cursor={'pointer'}
      />
      <InputRightElement
        children={<Icon as={X} w={5} h={5} color={'red'} />}
        data-test="input-keep-button"
        onClick={() => handleKeepReset?.(false)}
        zIndex={1}
        cursor={'pointer'}
      />
    </div>
  ) : null;

  const _useOverride = useOverride && value !== externallySetValue;

  return (
    <FormControl>
      <Label label={label} tooltip={tooltip} isDisabled={isDisabled && !highlight} />
      <InputGroup size="sm">
        {type === 'number' ? (
          <NumberInput
            onChange={_onChange}
            onBlur={handleBlur}
            onFocus={handleFocus}
            value={formattedAmount}
            min={min as number}
            max={max as number}
            step={step}
            isDisabled={isDisabled && !highlight}
            isReadOnly={highlight}
            borderColor={highlight ? 'green' : _useOverride ? 'orange' : 'inherit'}
            backgroundColor={colorMode.colorMode === 'dark' ? 'gray.800' : 'white'}
            title={numberFormatter?.(value as number)}
            w={'100%'}
          >
            <NumberInputField fontWeight={highlight ? '700' : 'normal'} />
            {highlight ? (
              keepOrReset
            ) : (
              <>
                <InputRightElement
                  children={<Icon as={X} size={'xs'} color={'#888'} mr={12} />}
                  data-test="input-clear-button"
                  onClick={handleClear}
                  zIndex={1}
                  opacity={highlight ? 0.3 : 1}
                  style={highlight ? { pointerEvents: 'none', cursor: 'not-allowed' } : {}}
                />
                <Box
                  sx={highlight ? { div: { pointerEvents: 'none', cursor: 'not-allowed' } } : {}}
                >
                  <NumberInputStepper>
                    <NumberIncrementStepper opacity={highlight ? 0.3 : 1} />
                    <NumberDecrementStepper opacity={highlight ? 0.3 : 1} />
                  </NumberInputStepper>
                </Box>
              </>
            )}
          </NumberInput>
        ) : (
          <>
            <Input
              size="sm"
              type="date"
              value={externallySetValue}
              onChange={handleDateChangeEvent}
              onBlur={handleDateBlur}
              onKeyUp={handleKeyUp}
              isDisabled={isDisabled && !highlight}
              isReadOnly={highlight}
              backgroundColor={colorMode.colorMode === 'dark' ? 'gray.800' : 'white'}
              borderColor={highlight ? 'green' : _useOverride ? 'orange' : 'inherit'}
              transitionProperty={'border-color'}
              transitionDuration={'1s'}
              fontWeight={highlight ? '700' : 'normal'}
              min={min as string}
              max={max as string}
              sx={{
                '&::-webkit-calendar-picker-indicator': { marginRight: '-7px' },
                '&::-webkit-datetime-edit-month-field:focus, &::-webkit-datetime-edit-day-field:focus, &::-webkit-datetime-edit-year-field:focus':
                  {
                    color: 'light-dark(#fff, rgb(0, 0, 0))' // mac (14.5) chrome (127) / chakra bug: highlighttext should be white
                  }
              }}
            />
            {highlight && keepOrReset}
          </>
        )}
      </InputGroup>
    </FormControl>
  );
};

export const CheckboxInput = ({
  isChecked = false,
  onChange,
  isDisabled,
  useOverride,
  label
}: {
  isChecked?: boolean;
  onChange?: (isChecked: boolean) => void;
  isDisabled?: boolean;
  useOverride?: boolean;
  label: string;
}) => {
  const [checked, setChecked] = useState(isChecked);
  const _onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setChecked(e.target.checked);
      onChange?.(e.target.checked);
    },
    [onChange]
  );
  useEffect(() => {
    if (!useOverride) setChecked(isChecked);
  }, [isChecked, useOverride]);
  return (
    <Checkbox
      isChecked={isChecked}
      onChange={_onChange}
      borderColor={useOverride && isChecked !== checked ? 'orange' : 'inherit'}
      transitionProperty={'border-color'}
      transitionDuration={'1s'}
      isDisabled={isDisabled}
      variant={'contrastBg'}
      colorScheme={'teal'}
    >
      {label}
    </Checkbox>
  );
};

export const Label = (props: {
  label: string;
  tooltip?: ReactElement | string;
  isDisabled?: boolean;
}) => {
  return (
    <FormLabel mr={0}>
      <HStack>
        <Text
          color={props.isDisabled ? '#888' : 'inherit'}
          fontSize={'.9em'}
          fontFamily={'heading'}
        >
          {props.label}
        </Text>
        {props.tooltip && (
          <Tooltip label={props.tooltip}>
            <Icon as={Info} ml={1} mr={'6px'} color={'#888'} cursor={'help'} />
          </Tooltip>
        )}
      </HStack>
    </FormLabel>
  );
};
