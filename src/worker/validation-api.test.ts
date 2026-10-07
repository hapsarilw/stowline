import { describe, expect, it } from 'vitest';
import { generateBenchCall, generateSampleCall } from '@/domain';
import { validationApi } from './validation-api';

describe('validation worker API', () => {
  it('runs full validation on plain data and reports the golden fixture', () => {
    const call = generateSampleCall();
    const report = validationApi.validate({
      vessel: call.vessel,
      containers: [...call.containers, ...call.loadList.map((x) => x.container)],
      placements: call.plan.placements,
    });
    expect(report.violations).toHaveLength(7);
    expect(report).toMatchObject({ errors: 6, warnings: 1 });
    expect(report.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('only sends data that survives structured clone', () => {
    const input = generateBenchCall(500);
    const report = validationApi.validate(input);
    expect(structuredClone(report)).toEqual(report);
    expect(structuredClone(input)).toEqual(input);
  });
});
