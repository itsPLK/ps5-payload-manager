import assert from 'node:assert/strict'
import test from 'node:test'

import { getInstalledPayloads, getPayloadStatus } from './payloadStatus.js'

test('同一插件在不同仓库声明相同版本时不显示更新', () => {
  const status = getPayloadStatus(
    { filename: 'etaHEN-v1.8.elf', version: 'v1.8' },
    [{ filename: 'etaHEN_v1.8.elf', version: '1.8' }]
  )

  assert.equal(status.isInstalled, true)
  assert.equal(status.isUpdate, false)
  assert.equal(status.installedFilename, 'etaHEN_v1.8.elf')
})

test('同一插件有更高版本时仍显示更新', () => {
  const status = getPayloadStatus(
    { filename: 'etaHEN_v1.9.elf', version: 'v1.9' },
    [{ filename: 'etaHEN_v1.8.elf', version: 'v1.8' }]
  )

  assert.equal(status.isInstalled, false)
  assert.equal(status.isUpdate, true)
  assert.equal(status.installedFilename, 'etaHEN_v1.8.elf')
})

test('缺失元数据版本时按文件名版本判定', () => {
  const status = getPayloadStatus(
    { filename: 'ftpsrv-v0.19.elf' },
    [{ filename: 'ftpsrv_v0.19.elf', version: '' }]
  )

  assert.equal(status.isInstalled, true)
  assert.equal(status.isUpdate, false)
})

test('同一仓库同名文件但版本变化时显示更新', () => {
  const status = getPayloadStatus(
    {
      filename: 'ftpsrv-ps5.elf',
      version: '1.15-ng-stable',
      source_url: 'https://github.com/drakmor/ftpsrv'
    },
    [{
      filename: 'ftpsrv-ps5.elf',
      version: 'v0.21',
      sourceUrl: 'https://github.com/drakmor/ftpsrv'
    }]
  )

  assert.equal(status.isInstalled, false)
  assert.equal(status.isUpdate, true)
  assert.equal(status.installedFilename, 'ftpsrv-ps5.elf')
})

test('不同仓库的同名文件不构成更新关系', () => {
  const status = getPayloadStatus(
    {
      filename: 'ftpsrv-ps5.elf',
      version: '1.15-ng-stable',
      source_url: 'https://github.com/drakmor/ftpsrv'
    },
    [{
      filename: 'ftpsrv-ps5.elf',
      version: 'v0.21',
      sourceUrl: 'https://github.com/ps5-payload-dev/ftpsrv'
    }]
  )

  assert.equal(status.isInstalled, false)
  assert.equal(status.isUpdate, false)
  assert.equal(status.installedFilename, undefined)
})

test('缺失仓库 URL 时按源 ID 和源名阻断跨仓库更新', () => {
  const bySourceId = getPayloadStatus(
    {
      filename: 'ftpsrv-ps5.elf',
      version: '1.15-ng-stable',
      source_id: 'source_drakmor'
    },
    [{
      filename: 'ftpsrv-ps5.elf',
      version: 'v0.21',
      sourceId: 'source_ps5_payload_dev'
    }]
  )
  const bySourceName = getPayloadStatus(
    {
      filename: 'ftpsrv-ps5.elf',
      version: '1.15-ng-stable',
      source_name: 'drakmor/ftpsrv'
    },
    [{
      filename: 'ftpsrv-ps5.elf',
      version: 'v0.21',
      sourceName: 'ps5-payload-dev/ftpsrv'
    }]
  )

  assert.equal(bySourceId.isUpdate, false)
  assert.equal(bySourceName.isUpdate, false)
})

test('USB 导入的同名文件不构成仓库更新关系', () => {
  const status = getPayloadStatus(
    {
      filename: 'ftpsrv-ps5.elf',
      version: '1.15-ng-stable',
      source_url: 'https://github.com/drakmor/ftpsrv'
    },
    [{
      filename: 'ftpsrv-ps5.elf',
      version: 'v0.21',
      installSource: 'usb'
    }]
  )

  assert.equal(status.isInstalled, false)
  assert.equal(status.isUpdate, false)
})

test('挂载 USB 中的文件不作为内部已安装插件参与更新判断', () => {
  const installedPayloads = getInstalledPayloads(
    ['/data/pldmgr/ftpsrv-ps5.elf', '/mnt/usb0/pldmgr/ftpsrv-ps5.elf'],
    {
      'ftpsrv-ps5.elf': {
        version: 'v0.21',
        source: 'source_ftpsrv',
        source_name: 'ps5-payload-dev/ftpsrv',
        install_source: 'repository',
        install_source_detail: 'https://github.com/ps5-payload-dev/ftpsrv'
      }
    }
  )

  assert.deepEqual(installedPayloads, [{
    filename: 'ftpsrv-ps5.elf',
    version: 'v0.21',
    sourceId: 'source_ftpsrv',
    sourceName: 'ps5-payload-dev/ftpsrv',
    sourceUrl: 'https://github.com/ps5-payload-dev/ftpsrv',
    installSource: 'repository'
  }])
})
