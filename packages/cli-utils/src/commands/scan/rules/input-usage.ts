import { getNamedType } from 'graphql';

import type { ScanRule, RuleDatapoint } from '../types';

export interface InputUsageData {
  kind: 'enum-value' | 'input-field';
  count: number;
}

/** Usage counts for the input side of the schema: which enum values are passed
 * and which input-object fields are set, keyed by coordinate (`Enum.VALUE` /
 * `Input.field`). Answers "which enum values / input fields do we actually
 * use", which neither field usage nor coverage captures. */
export const inputUsage: ScanRule<InputUsageData> = {
  name: 'input-usage',
  description: 'Usage counts for enum values and input-object fields.',
  create(context) {
    const counts = new Map<string, { kind: InputUsageData['kind']; count: number }>();
    const bump = (coordinate: string, kind: InputUsageData['kind']) => {
      const entry = counts.get(coordinate);
      if (entry) entry.count++;
      else counts.set(coordinate, { kind, count: 1 });
    };

    return {
      visitor: {
        EnumValue: {
          enter(node) {
            const inputType = context.getInputType();
            if (inputType) bump(`${getNamedType(inputType).name}.${node.value}`, 'enum-value');
          },
        },
        ObjectField: {
          enter(node) {
            const parentInput = context.getParentInputType();
            if (parentInput)
              bump(`${getNamedType(parentInput).name}.${node.name.value}`, 'input-field');
          },
        },
      },

      collect() {
        const datapoints: RuleDatapoint<InputUsageData>[] = [...counts.entries()]
          .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
          .map(([coordinate, { kind, count }]) => ({
            ref: { kind: 'field', coordinate },
            message: `${coordinate} (${kind}) used ${count} time(s)`,
            weight: count,
            data: { kind, count },
          }));
        return datapoints;
      },
    };
  },
};
