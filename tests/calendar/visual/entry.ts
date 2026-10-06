if (new URLSearchParams(location.search).has('surface')) {
  void import('./desktop')
} else {
  void import('./main')
}
