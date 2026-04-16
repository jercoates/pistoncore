/**
 * PistonCore API client.
 * All fetch calls to the backend go through here.
 * The frontend never calls HA directly.
 */

import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 15_000,
})

// ── Pistons ──────────────────────────────────────────────────────────────────

export const getPistons = () =>
  api.get('/pistons').then(r => r.data)

export const getPiston = (id) =>
  api.get(`/pistons/${id}`).then(r => r.data)

export const createPiston = (piston) =>
  api.post('/pistons', piston).then(r => r.data)

export const updatePiston = (id, piston) =>
  api.put(`/pistons/${id}`, piston).then(r => r.data)

export const deletePiston = (id) =>
  api.delete(`/pistons/${id}`).then(r => r.data)

export const togglePiston = (id) =>
  api.post(`/pistons/${id}/toggle`).then(r => r.data)

export const importPiston = (pistonData, deviceMap = {}) =>
  api.post('/pistons/import', { piston_data: pistonData, device_map: deviceMap }).then(r => r.data)

// ── Entities ──────────────────────────────────────────────────────────────────

export const getEntities = (params = {}) =>
  api.get('/entities', { params }).then(r => r.data)

export const getDomains = () =>
  api.get('/entities/domains').then(r => r.data)

export const getServices = () =>
  api.get('/entities/services').then(r => r.data)

export const refreshEntities = () =>
  api.post('/entities/refresh').then(r => r.data)

// ── Globals ───────────────────────────────────────────────────────────────────

export const getGlobals = () =>
  api.get('/globals').then(r => r.data)

export const saveGlobals = (globals) =>
  api.put('/globals', globals).then(r => r.data)

// ── Settings ──────────────────────────────────────────────────────────────────

export const getSettings = () =>
  api.get('/settings').then(r => r.data)

export const saveSettings = (settings) =>
  api.put('/settings', settings).then(r => r.data)

export const testConnection = () =>
  api.get('/settings/test-connection').then(r => r.data)

// ── Compile / Deploy ──────────────────────────────────────────────────────────

export const previewCompile = (id) =>
  api.post(`/compile/${id}/preview`).then(r => r.data)

export const deployPiston = (id) =>
  api.post(`/compile/${id}/deploy`).then(r => r.data)

// ── Health ────────────────────────────────────────────────────────────────────

export const getHealth = () =>
  api.get('/health').then(r => r.data)
