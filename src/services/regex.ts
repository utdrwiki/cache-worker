function buildClassReplacementRegex(tag: string, classPrefix: string) {
  return new RegExp(`<${tag}([^>]*? class=")([^"]* )?${classPrefix}[\\w-]*( [^"]*)?("[^>]*>)`, 'gu');
}

export function replaceHtmlClassByPrefix(htmlText: string, tag: string, classReplacement: { classPrefix: string, className: string }) {
  const regex = buildClassReplacementRegex(tag, classReplacement.classPrefix);
  const replacement = `<${tag}$1$2${classReplacement.className}$3$4`;
  return htmlText.replace(regex, replacement);
}
