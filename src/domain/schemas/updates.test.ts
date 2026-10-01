import { describe, expect, it } from 'vitest';
import { updateConditionSchema, updateExperimentSchema, updateInputSchema, updateObservationSchema, updateResultSchema, updateStepSchema } from './experiments';
import { updateExperimentTypeSchema, updateMemberSchema, updateProfileSchema, updateTeamSchema } from './platform';
import { updateMilestoneSchema, updateProjectSchema } from './projects';

describe('update schemas', () => {
  it('return only the fields a PATCH sends, never create-time defaults', () => {
    const partial = { updateConditionSchema, updateInputSchema, updateStepSchema, updateObservationSchema, updateResultSchema, updateTeamSchema, updateExperimentTypeSchema, updateMemberSchema, updateProfileSchema, updateMilestoneSchema };
    for (const [name, schema] of Object.entries(partial)) {
      expect(schema.parse({}), name).toEqual({});
    }
    expect(updateExperimentSchema.parse({ expectedVersion: 3 })).toEqual({ expectedVersion: 3 });
    expect(updateProjectSchema.parse({ expectedVersion: 3 })).toEqual({ expectedVersion: 3 });
  });

  it('keep the fields that are sent', () => {
    expect(updateObservationSchema.parse({ body: 'Typo fixed' })).toEqual({ body: 'Typo fixed' });
    expect(updateInputSchema.parse({ quantity: 2 })).toEqual({ quantity: 2 });
    expect(updateExperimentTypeSchema.parse({ isActive: false })).toEqual({ isActive: false });
  });
});
