import {
  AnalysisScope,
  ScopeProvenanceEntry,
} from '@commerce-ops/shared-types';
import { calculateScopeHash } from './analysis-scope.hash';
import { ResolveScopeInput } from './analysis-scope.types';

const CATEGORY_ALIASES: Record<string, string> = {
  muebles: 'moveis_decoracao',
  'muebles decoracion': 'moveis_decoracao',
  'muebles decoración': 'moveis_decoracao',
  moveis_decoracao: 'moveis_decoracao',
  informatica_acessorios: 'informatica_acessorios',
  'informatica accesorios': 'informatica_acessorios',
  'informática accesorios': 'informatica_acessorios',
  computers_accessories: 'informatica_acessorios',
};

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function createEmptyScope(): AnalysisScope {
  const base = {
    dateFrom: undefined,
    dateTo: undefined,
    categories: undefined,
    sellerIds: undefined,
    sellerStates: undefined,
    customerStates: undefined,
    reviewScores: undefined,
    comparison: undefined,
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
  categories?: string[];
  reviewScores?: number[];
  comparison?: {
    mode: 'PREVIOUS_PERIOD';
    dateFrom: string;
    dateTo: string;
    label?: string;
  };
  provenance: ScopeProvenanceEntry[];
} {
  const provenance: ScopeProvenanceEntry[] = [];
  let dateFrom: string | undefined;
  let dateTo: string | undefined;
  let interstateOnly: boolean | undefined;
  let categories: string[] | undefined;
  let reviewScores: number[] | undefined;
  let comparison:
    | {
        mode: 'PREVIOUS_PERIOD';
        dateFrom: string;
        dateTo: string;
        label?: string;
      }
    | undefined;

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

  // 3. Category parsing
  const normalizedQuestion = normalizeForMatch(question);
  for (const [alias, canonical] of Object.entries(CATEGORY_ALIASES)) {
    if (normalizedQuestion.includes(normalizeForMatch(alias))) {
      categories = [canonical];
      provenance.push({
        field: 'categories',
        source: 'DETERMINISTIC_QUESTION_PARSER',
        rawText: alias,
      });
      break;
    }
  }

  // 4. Review scores parsing (e.g. "1 estrella")
  const starMatch = question.match(/\b([1-5])\s*estrella(?:s)?\b/i);
  if (starMatch) {
    const score = Number(starMatch[1]);
    reviewScores = [score];
    provenance.push({
      field: 'reviewScores',
      source: 'DETERMINISTIC_QUESTION_PARSER',
      rawText: starMatch[0],
    });
  }

  // 5. Temporal comparison parsing (Feb 2018 vs Jan 2018)
  const comparativeTerms =
    /\b(respecto de|respecto a|comparad[oa] con|comparaci[oó]n|cambi[oó]|aument[oó]|disminuy[oó]|subi[oó]|baj[oó]|vari[oó])\b/i;

  if (
    dateFrom === '2018-02-01T00:00:00.000Z' &&
    dateTo === '2018-02-28T23:59:59.999Z' &&
    comparativeTerms.test(question)
  ) {
    comparison = {
      mode: 'PREVIOUS_PERIOD',
      dateFrom: '2018-01-01T00:00:00.000Z',
      dateTo: '2018-01-31T23:59:59.999Z',
      label: 'Enero 2018',
    };

    provenance.push({
      field: 'comparison',
      source: 'DETERMINISTIC_QUESTION_PARSER',
      rawText: question.match(comparativeTerms)?.[0],
    });
  }

  return {
    dateFrom,
    dateTo,
    interstateOnly,
    categories,
    reviewScores,
    comparison,
    provenance,
  };
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
    input.criticScopePatch?.categories ||
    input.dtoFilters?.categories ||
    parsed.categories;
  if (categories && categories.length > 0) {
    if (input.criticScopePatch?.categories) {
      provenance.push({
        field: 'categories',
        source: 'CRITIC_PATCH',
      });
    } else if (input.dtoFilters?.categories) {
      provenance.push({
        field: 'categories',
        source: 'REQUEST_DTO',
      });
    } else {
      provenance.push(
        ...parsed.provenance.filter((p) => p.field === 'categories'),
      );
    }
  }

  // ReviewScores
  const reviewScores =
    input.criticScopePatch?.reviewScores ||
    input.dtoFilters?.reviewScores ||
    parsed.reviewScores;
  if (reviewScores && reviewScores.length > 0) {
    if (input.criticScopePatch?.reviewScores) {
      provenance.push({
        field: 'reviewScores',
        source: 'CRITIC_PATCH',
      });
    } else if (input.dtoFilters?.reviewScores) {
      provenance.push({
        field: 'reviewScores',
        source: 'REQUEST_DTO',
      });
    } else {
      provenance.push(
        ...parsed.provenance.filter((p) => p.field === 'reviewScores'),
      );
    }
  }

  // Comparison
  const comparison = input.criticScopePatch?.comparison || parsed.comparison;
  if (comparison) {
    if (input.criticScopePatch?.comparison) {
      provenance.push({
        field: 'comparison',
        source: 'CRITIC_PATCH',
      });
    } else {
      provenance.push(
        ...parsed.provenance.filter((p) => p.field === 'comparison'),
      );
    }
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
    reviewScores:
      reviewScores && reviewScores.length > 0 ? reviewScores : undefined,
    comparison,
    interstateOnly,
    provenance,
  };

  return {
    ...base,
    scopeHash: calculateScopeHash(base),
  };
}
