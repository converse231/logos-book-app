// The nudge that follows a 1★ or 5★ rating.
//
// The extremes are the only ratings people actually want to explain, and the
// second right after tapping is the only moment they will. Three stars gets
// nothing — there's no story there, and asking for one is nagging.
//
// The copy splits by direction deliberately. One neutral string for both ends
// would read as tone-deaf on a one-star: brightly asking someone to elaborate on
// a book they hated.

export interface RatingPrompt {
  title: string;
  body: string;
  /** Replaces the review field's generic placeholder. */
  placeholder: string;
}

export function extremeRatingPrompt(rating: number): RatingPrompt | null {
  if (rating >= 5)
    return {
      title: 'What made it so good?',
      body: 'Five stars is a strong call — a line or two could put this book on someone else’s shelf.',
      placeholder: 'What made it so good?',
    };
  if (rating > 0 && rating <= 1)
    return {
      title: 'What went wrong?',
      body: 'One star is worth explaining. Honest reviews are the ones other readers trust.',
      placeholder: 'What didn’t work for you?',
    };
  return null;
}
