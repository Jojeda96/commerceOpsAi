export const REVIEW_COMPLAINT_TAXONOMY_VERSION = 'v1.0.0';

export type ComplaintTopic = 'DELIVERY_DELAY' | 'PACKAGE_DAMAGE';

export interface SubthemeDefinition {
  code: string;
  terms: string[];
}

export interface TopicTaxonomyDefinition {
  topic: ComplaintTopic;
  subthemes: SubthemeDefinition[];
}

export const REVIEW_COMPLAINT_TAXONOMY: TopicTaxonomyDefinition[] = [
  {
    topic: 'DELIVERY_DELAY',
    subthemes: [
      {
        code: 'LATE_DELIVERY',
        terms: ['atraso', 'atrasado', 'atrasada', 'demora', 'demorou', 'tarde'],
      },
      {
        code: 'NOT_DELIVERED',
        terms: [
          'nao chegou',
          'nao recebi',
          'produto nao entregue',
          'nunca chegou',
          'nao entregue',
        ],
      },
      {
        code: 'DEADLINE_MISSED',
        terms: [
          'fora do prazo',
          'passou do prazo',
          'prazo vencido',
          'entrega prevista',
          'previsao de entrega',
        ],
      },
    ],
  },
  {
    topic: 'PACKAGE_DAMAGE',
    subthemes: [
      {
        code: 'BROKEN_PRODUCT',
        terms: ['quebrado', 'quebrada', 'rachado', 'rachada', 'partido', 'partida'],
      },
      {
        code: 'DAMAGED_PRODUCT',
        terms: ['danificado', 'danificada', 'avariado', 'avariada', 'estragado', 'estragada'],
      },
      {
        code: 'DAMAGED_PACKAGING',
        terms: [
          'caixa amassada',
          'embalagem danificada',
          'embalagem aberta',
          'pacote rasgado',
          'caixa quebrada',
          'amassada',
          'rasgada',
        ],
      },
    ],
  },
];
