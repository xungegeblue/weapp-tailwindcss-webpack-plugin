import ClassGenerator from '../classGenerator'
// import chalk from 'chalk'
import type { IManglePluginOptions } from '@/types'
import { Compiler, Compilation, sources } from 'webpack'
import { validate } from '../shared'

const optimize = (compiler: Compiler, [file, originalSource]: [string, sources.Source], compilation: Compilation, opts: IManglePluginOptions, classGenerator: ClassGenerator) => {
  let classnameRegex
  if (file.match(/.+\.css.*$/)) {
    // eslint-disable-next-line no-useless-escape
    classnameRegex = new RegExp(`\\\.(${opts.classNameRegExp})`, 'g')
  } else if (file.match(/.+\.js.*$/) || file.match(/.+\.html.*$/)) {
    // eslint-disable-next-line no-useless-escape
    classnameRegex = new RegExp(`["'\`.\\\s](${opts.classNameRegExp})`, 'g')
  }
  if (!classnameRegex) {
    return
  }
  if (opts.ignorePrefix && opts.ignorePrefixRegExp) {
    throw new Error('Use only either "ignorePrefix" or "ignorePrefixRegExp".')
  }
  let ignorePrefixRegExp
  let source
  let match
  if (opts.ignorePrefixRegExp) {
    ignorePrefixRegExp = new RegExp(`^${opts.ignorePrefixRegExp}`)
  }

  const rawSource = originalSource.source().toString()

  const { ReplaceSource } = compiler.webpack.sources

  while ((match = classnameRegex.exec(rawSource))) {
    const originalName = match[1]
    let targetName = originalName

    let originalPrefix = ''
    if (opts.ignorePrefix) {
      let ignorePrefix = opts.ignorePrefix
      if (typeof ignorePrefix === 'string') {
        ignorePrefix = [ignorePrefix]
      }
      for (let i = 0; i < ignorePrefix.length; i++) {
        if (originalName.startsWith(ignorePrefix[i])) {
          originalPrefix = ignorePrefix[i]
          break
        }
      }
    }
    if (ignorePrefixRegExp) {
      const prefix = ignorePrefixRegExp.exec(originalName)
      if (prefix && prefix.length > 0) {
        originalPrefix = prefix[0]
      }
    }
    if (originalPrefix) {
      targetName = originalName.slice(originalPrefix.length)
      if (opts.log) {
        console.log(`Skip the prefix ${originalPrefix} of ${originalName}`)
      }
    }

    const newClass = classGenerator.generateClassName(targetName)
    if (!source) source = new ReplaceSource(originalSource)
    const startPos = match.index + match[0].indexOf(match[1])
    newClass.usedBy.push(`${file}:${startPos}`)
    const newClassName = `${originalPrefix}${newClass.name}`
    source.replace(startPos, startPos + originalName.length - 1, newClassName)
  }
  if (!source) {
    return
  }
  compilation.updateAsset(file, source)
}

const optimizer = (compiler: Compiler, compilation: Compilation, opts: IManglePluginOptions) => (assets: { [index: string]: sources.Source }) => {
  if (!opts.classNameRegExp) throw new Error("'classNameRegExp' option is required. e.g. '[c]-[a-z][a-zA-Z0-9_]*'")
  const classGenerator = new ClassGenerator(opts)
  Object.entries(assets).forEach((asset) => optimize(compiler, asset, compilation, opts, classGenerator))
  validate(opts, classGenerator)
}

export default optimizer
