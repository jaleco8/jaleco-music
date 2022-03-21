import trae from 'trae'
import configService from './config'

const jalecoMusicService = trae.create({
  baseUrl: configService.apiUrl
})

export default jalecoMusicService
