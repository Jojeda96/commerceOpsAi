export const mockReviewsFixture = [
  {
    reviewId: 'rev-001',
    orderId: 'ord-001',
    reviewScore: 1,
    reviewCommentTitle: 'Péssimo',
    reviewCommentMessage:
      'O produto não chegou no prazo. Entrega muito atrasada e demorou 20 dias a mais.',
    reviewCreationDate: new Date('2023-01-10'),
    reviewAnswerTimestamp: new Date('2023-01-12'),
  },
  {
    reviewId: 'rev-002',
    orderId: 'ord-002',
    reviewScore: 1,
    reviewCommentTitle: 'Caixa amassada',
    reviewCommentMessage: 'Embalagem danificada e produto veio quebrado!',
    reviewCreationDate: new Date('2023-01-15'),
    reviewAnswerTimestamp: new Date('2023-01-16'),
  },
  {
    reviewId: 'rev-003',
    orderId: 'ord-003',
    reviewScore: 2,
    reviewCommentTitle: 'Demora e danificado',
    reviewCommentMessage:
      'Demorou muito para entregar e a caixa veio toda rasgada e amassada.',
    reviewCreationDate: new Date('2023-01-20'),
    reviewAnswerTimestamp: new Date('2023-01-21'),
  },
];
