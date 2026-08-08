/** Shared responsive styles for filter bars and form controls on mobile. */
export const filterBarSx = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 1,
  alignItems: 'center',
  width: '100%',
} as const

/** Full-width filters on phones; compact on sm+. Font ≥16px on xs avoids iOS input zoom. */
export const filterControlSx = {
  minWidth: { xs: '100%', sm: 140 },
  maxWidth: { xs: '100%', sm: 180 },
  flex: { xs: '1 1 calc(50% - 4px)', sm: '0 0 auto' },
  '& .MuiInputBase-root': { fontSize: { xs: 16, sm: 13 } },
  '& .MuiInputLabel-root': { fontSize: { xs: 16, sm: 13 } },
} as const

/** Narrower controls that still stretch on very small screens. */
export const filterControlWideSx = {
  ...filterControlSx,
  flex: { xs: '1 1 100%', sm: '0 0 auto' },
  maxWidth: { xs: '100%', sm: 200 },
} as const
