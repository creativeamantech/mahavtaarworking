import { 
  buildCityPivot, 
  buildTeamPivot, 
  buildCrossTab, 
  buildBucketCityPivot, 
  buildExecCityPivot 
} from './pivots.ts';

self.onmessage = (e: MessageEvent) => {
  const { type, payload, id } = e.data;
  const { records, targets } = payload;

  try {
    let result;
    switch (type) {
      case 'buildCityPivot':
        result = buildCityPivot(records, targets);
        break;
      case 'buildTeamPivot':
        result = buildTeamPivot(records, targets);
        break;
      case 'buildCrossTab':
        result = buildCrossTab(records, targets);
        break;
      case 'buildBucketCityPivot':
        result = buildBucketCityPivot(records, targets);
        break;
      case 'buildExecCityPivot':
        result = buildExecCityPivot(records, targets);
        break;
      default:
        throw new Error(`Unknown worker message type: ${type}`);
    }

    self.postMessage({ id, result, success: true });
  } catch (error) {
    self.postMessage({ id, error: (error as Error).message, success: false });
  }
};
