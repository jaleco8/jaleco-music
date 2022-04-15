import jalecoMusicService from './jaleco-music'

const trackService = {}

trackService.search = function (q) {
  const type = 'track'

  return jalecoMusicService.get('/search', {
    params: { q, type }
  })
    .then(res => res.data)
}

trackService.getById = function (id) {
  return jalecoMusicService.get(`/tracks/${id}`)
    .then(res => res.data)
}

export default trackService
