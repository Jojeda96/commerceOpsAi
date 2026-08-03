import {
  AnalysisScope,
  ScopeProvenanceEntry,
} from '@commerce-ops/shared-types';
import { calculateScopeHash } from './analysis-scope.hash';
import { ResolveScopeInput } from './analysis-scope.types';

export function createEmptyScope(): AnalysisScope {
  const base = {
    dateFrom: undefined,
    dateTo: undefined,
    categories: undefined,
    sellerIds: undefined,
    sellerStates: undefined,
    customerStates: undefined,
    interstateOnly: false,
    provenance: [],
  };
  return {
    ...base,
    scopeHash: calculateScopeHash(base),
  };
}

export function parseDeterministicQuestionFilters(question: string): {
  dateFrom?: string;
  dateTo?: string;
  interstateOnly?: boolean;
  provenance: ScopeProvenanceEntry[];
} {
  const provenance: ScopeProvenanceEntry[] = [];
  let dateFrom: string | undefined;
  let dateTo: string | undefined;
  let interstateOnly: boolean | undefined;

  // 1. Explicit date regexes
  // Example: "febrero de 2018"
  const febr2018Match = question.match(/febrero\s+(?:de\s+)?2018/i);
  if (febr2018Match) {
    dateFrom = '2018-02-01T00:00:00.000Z';
    dateTo = '2018-02-28T23:59:59.999Z';
    provenance.push({
      field: 'dateFrom',
      source: 'DETERMINISTIC_QUESTION_PARSER',
      rawText: febr2018Match[0],
    });
    provenance.push({
      field: 'dateTo',
      source: 'DETERMINISTIC_QUESTION_PARSER',
      rawText: febr2018Match[0],
    });
  }

  // Example: "entre enero y marzo de 2018"
  const range2018Match = question.match(
    /entre\s+enero\s+y\s+marzo\s+(?:de\s+)?2018/i,
  );
  if (range2018Match) {
    dateFrom = '2018-01-01T00:00:00.000Z';
    dateTo = '2018-03-31T23:59:59.999Z';
    provenance.push({
      field: 'dateFrom',
      source: 'DETERMINISTIC_QUESTION_PARSER',
      rawText: range2018Match[0],
    });
    provenance.push({
      field: 'dateTo',
      source: 'DETERMINISTIC_QUESTION_PARSER',
      rawText: range2018Match[0],
    });
  }

  // Example: "desde YYYY-MM-DD"
  const desdeMatch = question.match(/desde\s+(\d{4}-\d{2}-\d{2})/i);
  if (desdeMatch) {
    dateFrom = `${desdeMatch[1]}T00:00:00.000Z`;
    provenance.push({
      field: 'dateFrom',
      source: 'DETERMINISTIC_QUESTION_PARSER',
      rawText: desdeMatch[0],
    });
  }

  // Example: "hasta YYYY-MM-DD"
  const hastaMatch = question.match(/hasta\s+(\d{4}-\d{2}-\d{2})/i);
  if (hastaMatch) {
    dateTo = `${hastaMatch[1]}T23:59:59.999Z`;
    provenance.push({
      field: 'dateTo',
      source: 'DETERMINISTIC_QUESTION_PARSER',
      rawText: hastaMatch[0],
    });
  }

  // 2. Interstate regex
  const interstateRegex =
    /interestatal|entre\s+estados|estado\s+de\s+origen\s+y\s+destino\s+distintos/i;
  if (interstateRegex.test(question)) {
    interstateOnly = true;
    provenance.push({
      field: 'interstateOnly',
      source: 'DETERMINISTIC_QUESTION_PARSER',
      rawText: question.match(interstateRegex)?.[0],
    });
  }

  return { dateFrom, dateTo, interstateOnly, provenance };
}

export function resolveAnalysisScope(input: ResolveScopeInput): AnalysisScope {
  const provenance: ScopeProvenanceEntry[] = [];
  const parsed = parseDeterministicQuestionFilters(input.question || '');

  // Priorities: Critic Patch > Request DTO > Deterministic Question Parser > Unspecified

  // DateFrom
  let dateFrom: string | undefined = input.criticScopePatch?.dateFrom;
  if (dateFrom !== undefined) {
    provenance.push({ field: 'dateFrom', source: 'CRITIC_PATCH' });
  } else if (input.dtoFilters?.dateFrom) {
    dateFrom = input.dtoFilters.dateFrom;
    provenance.push({ field: 'dateFrom', source: 'REQUEST_DTO' });
  } else if (parsed.dateFrom) {
    dateFrom = parsed.dateFrom;
    provenance.push(...parsed.provenance.filter((p) => p.field === 'dateFrom'));
  }

  // DateTo
  let dateTo: string | undefined = input.criticScopePatch?.dateTo;
  if (dateTo !== undefined) {
    provenance.push({ field: 'dateTo', source: 'CRITIC_PATCH' });
  } else if (input.dtoFilters?.dateTo) {
    dateTo = input.dtoFilters.dateTo;
    provenance.push({ field: 'dateTo', source: 'REQUEST_DTO' });
  } else if (parsed.dateTo) {
    dateTo = parsed.dateTo;
    provenance.push(...parsed.provenance.filter((p) => p.field === 'dateTo'));
  }

  // InterstateOnly
  let interstateOnly = false;
  if (input.criticScopePatch?.interstateOnly !== undefined) {
    interstateOnly = input.criticScopePatch.interstateOnly;
    provenance.push({ field: 'interstateOnly', source: 'CRITIC_PATCH' });
  } else if (input.dtoFilters?.interstateOnly !== undefined) {
    interstateOnly = input.dtoFilters.interstateOnly;
    provenance.push({ field: 'interstateOnly', source: 'REQUEST_DTO' });
  } else if (parsed.interstateOnly !== undefined) {
    interstateOnly = parsed.interstateOnly;
    provenance.push(
      ...parsed.provenance.filter((p) => p.field === 'interstateOnly'),
    );
  }

  // Categories
  const categories =
    input.criticScopePatch?.categories || input.dtoFilters?.categories;
  if (categories && categories.length > 0) {
    provenance.push({
      field: 'categories',
      source: input.criticScopePatch?.categories
        ? 'CRITIC_PATCH'
        : 'REQUEST_DTO',
    });
  }

  // SellerIds
  const sellerIds =
    input.criticScopePatch?.sellerIds || input.dtoFilters?.sellerIds;

  // SellerStates
  const sellerStates =
    input.criticScopePatch?.sellerStates || input.dtoFilters?.sellerStates;

  // CustomerStates
  const customerStates =
    input.criticScopePatch?.customerStates || input.dtoFilters?.customerStates;

  const base = {
    dateFrom,
    dateTo,
    categories: categories && categories.length > 0 ? categories : undefined,
    sellerIds: sellerIds && sellerIds.length > 0 ? sellerIds : undefined,
    sellerStates:
      sellerStates && sellerStates.length > 0 ? sellerStates : undefined,
    customerStates:
      customerStates && customerStates.length > 0 ? customerStates : undefined,
    interstateOnly,
    provenance,
  };

  return {
    ...base,
    scopeHash: calculateScopeHash(base),
  };
}
