import { Grammar, Parser } from 'nearley';

import Card from 'datatypes/Card';
import CardDetails, { AllField } from 'datatypes/CardDetails';
import filterCardGrammar from 'generated/filtering/cardFilters';

// @ts-expect-error(TODO: figure this one out)
const compiledGrammar = Grammar.fromCompiled(filterCardGrammar);

const ALL_OPERATORS = [':', '=', '!=', '<>', '<', '<=', '>', '>='];

export const operatorsRegex = new RegExp(`(?:${ALL_OPERATORS.join('|')})`);

export const filterUses = (filter, name) => (filter?.fieldsUsed?.indexOf?.(name) ?? -1) >= 0;

export const filterUsedFields = (filter) => filter?.fieldsUsed ?? [];

export const filterToString = (filter) => filter?.stringify ?? 'empty filter';

export function makeFilter(filterText) {
  if (!filterText || filterText.trim() === '') {
    return {
      err: false,
      filter: null,
    };
  }

  const filterParser = new Parser(compiledGrammar);
  try {
    filterParser.feed(filterText);
  } catch (err) {
    return { err, filter: null };
  }
  const { results } = filterParser;
  if (results.length === 1) {
    const [filter] = results;
    filter.stringify = filterText;
    return {
      err: !filter,
      filter,
    };
  }

  return {
    err: results,
    filter: null,
  };
}

export const filterCardsDetails = (cards, filter) => (filter ? cards.filter((details) => filter({ details })) : cards);

export default {
  operators: ALL_OPERATORS,
  operatorsRegex,
  filterUses,
  filterUsedFields,
  filterToString,
  makeFilter,
  filterCardsDetails,
};
