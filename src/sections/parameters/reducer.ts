import { AnalysisFormData } from '../../calc.ts';
import dayjs from 'dayjs';
import { ChartSettings } from '../../charts/ChartControls.tsx';

type reducerState = AnalysisFormData & {
  chartSettings: ChartSettings;
  isDirty?: boolean;
  overrides: { [key: string]: boolean };
  overrideAll?: boolean;
};
const parametersReducer = (
  state: reducerState,
  action: {
    type: string;
    value?:
      | string
      | number
      | Date
      | dayjs.Dayjs
      | null
      | boolean
      | AnalysisFormData
      | ChartSettings;
    isDirty?: boolean;
    setOverride?: boolean;
  }
): reducerState => {
  const wrapState = (curState: reducerState) => {
    return {
      ...curState,
      isDirty: action.isDirty ?? false,
      overrides: { ...curState.overrides, [action.type]: action.setOverride ?? false }
    };
  };

  switch (action.type) {
    case 'analysisStart':
      if (dayjs(action.value as string).toDate() <= dayjs(state.analysisEnd).toDate()) {
        return {
          ...wrapState(state),
          analysisStart: action.value as string
        };
      } else
        return {
          ...wrapState(state),
          analysisStart: state.analysisEnd
        };

    case 'analysisEnd':
      if (dayjs(action.value as string).toDate() >= dayjs(state.analysisStart).toDate()) {
        return {
          ...wrapState(state),
          analysisEnd: action.value as string
        };
      } else return { ...state, analysisEnd: state.analysisStart };

    case 'isDirty':
      return { ...state, isDirty: action.value as boolean };
    case 'overrideAll':
      return {
        ...state,
        overrideAll: true,
        overrides: {
          initialSavingsAmount: true,
          analysisStart: true,
          withdrawalStart: true
        }
      };
    case 'setParameters':
      return {
        ...state,
        ...(action.value as reducerState)
      };
    case 'chartSettings':
      return {
        ...state,
        chartSettings: action.value as ChartSettings
      };
    default:
      break;
  }
  return state;
};

export default parametersReducer;
