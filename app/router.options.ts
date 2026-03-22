export default {
  scrollBehavior(
    to: { hash?: string },
    _from: unknown,
    savedPosition: { left: number; top: number } | null,
  ) {
    if (savedPosition) {
      return savedPosition
    }

    if (to.hash) {
      return {
        el: to.hash,
        top: 24,
        behavior: 'auto' as const,
      }
    }

    return {
      left: 0,
      top: 0,
    }
  },
}
