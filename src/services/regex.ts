import { ClassReplacement } from '../types';

class ClassReplacementElementHandler {
  private replacements: ClassReplacement[];

  constructor(replacements: ClassReplacement[]) {
    this.replacements = replacements;
  }

  element(element: Element) {
    element.setAttribute('class', element
      .getAttribute('class')
      ?.split(' ')
      .map(className => this.replacements
        .find(r => className.startsWith(r.classPrefix))?.className || className)
      .join(' ') || ''
    );
  }
}

export function replaceHtmlClasses(response: Response, replacements: ClassReplacement[]): Response {
  return new HTMLRewriter()
    .on('html', new ClassReplacementElementHandler(replacements))
    .transform(response);
}
