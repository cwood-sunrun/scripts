const { readFileSync, writeFileSync } = require('fs');
const fs = require("fs").promises;
const parse5 = require('parse5');
const path = require('node:path');

const ReplacementLinks = {
  twitter: '',
  instagram: '',
  facebook: '',
  linkedin: '',
  privacyPolicy: '',
  stateContractor: '',
}

const getParentLink = (node) => {
  if (!node) {
    console.error("No parent anchor tag found");
    return;
  }

  if (node.tagName === 'a') {
    return node;
  }

  return getParentLink(node.parentNode);
}

const parsePrivacyPolicy = (node) => {
  if (node.nodeName === '#text') {
    if (node.value.trim().toLowerCase() === 'privacy policy') {
      const parentLink = getParentLink(node);

      if (parentLink) {
        const href = parentLink.attrs.find(attr => attr.name === 'href');
        // The parser is being really generous and encoding html entities here, so we need to unencode them to match strings
        const adjustedHrefValue = href.value.replaceAll('&', '&amp;');
        return { value: adjustedHrefValue, type: "privacyPolicy" };
      }
    }
  }
}

const parseStateContractor = (node) => {
  if (node.nodeName === '#text') {
    if (node.value.trim().toLowerCase() === 'state contractor license information') {
      const parentLink = getParentLink(node);
      if (parentLink) {
        const href = parentLink.attrs.find(attr => attr.name === 'href');
        // The parser is being really generous and encoding html entities here, so we need to unencode them to match strings
        const adjustedHrefValue = href.value.replaceAll('&', '&amp;');
        return { value: adjustedHrefValue, type: "stateContractor" };
      }
    }
  }
}

const parseInstagramLink = (node) => {
  if (node.tagName === 'img') {
    const value = node.attrs.find(attr => attr.name === 'src' && (attr.value.toLowerCase().includes('ig-ico') || attr.value.toLowerCase().includes('instagram')));
    const alt = node.attrs.find(attr => attr.name === 'alt' && attr.value.toLowerCase() === 'instagram');
    if (value || alt) {
      const parentLink = getParentLink(node);

      if (parentLink) {
        const href = parentLink.attrs.find(attr => attr.name === 'href');
        // The parser is being really generous and encoding html entities here, so we need to unencode them to match strings
        const adjustedHrefValue = href.value.replaceAll('&', '&amp;');
        return { value: adjustedHrefValue, type: "instagram" };
      }
    }
  }
}

const parseFacebookLink = (node) => {
  if (node.tagName === 'img') {
    const value = node.attrs.find(attr => attr.name === 'src' && (attr.value.toLowerCase().includes('fb-ico') || attr.value.toLowerCase().includes('facebook')));
    const alt = node.attrs.find(attr => attr.name === 'alt' && attr.value.toLowerCase() === 'facebook');
    if (value || alt) {
      const parentLink = getParentLink(node);

      if (parentLink) {
        const href = parentLink.attrs.find(attr => attr.name === 'href');
        // The parser is being really generous and encoding html entities here, so we need to unencode them to match strings
        const adjustedHrefValue = href.value.replaceAll('&', '&amp;');
        return { value: adjustedHrefValue, type: "facebook" };
      }
    }
  }
}

const parseTwitterLink = (node) => {
  if (node.tagName === 'img') {
    const value = node.attrs.find(attr => attr.name === 'src' && attr.value.toLowerCase().includes('twitter'));
    if (value) {
      const parentLink = getParentLink(node);

      if (parentLink) {
        const href = parentLink.attrs.find(attr => attr.name === 'href');
        // The parser is being really generous and encoding html entities here, so we need to unencode them to match strings
        const adjustedHrefValue = href.value.replaceAll('&', '&amp;');
        return { value: adjustedHrefValue, type: "twitter" };
      }
    }
  }
}

const findLinks = (node) => {
  const parsers = [parseTwitterLink, parseFacebookLink, parseInstagramLink, parsePrivacyPolicy, parseStateContractor];
  return parsers.reduce((acc, parser) => {
    return [...acc, parser(node)];
  }, [])
}

const traverse = (node) => {
  let results = [];
  if (!node) return results;

  if (Array.isArray(node)) {
    const rootArrayResults = node.reduce((acc, innerNode) => {
      const results = traverse(innerNode)
      acc = [...acc, ...results];
      return acc;
    });
    results = results.concat(rootArrayResults);
  }

  if (node.childNodes) {
    const childResults = node.childNodes.reduce((acc, childNode) => {
      const results = traverse(childNode)
      if (Array.isArray(results)) {
        acc = [...results, ...acc];
      }
      return acc;
    }, []);

    results = results.concat(childResults);
  }

  const rootResults = findLinks(node);
  results = results.concat(rootResults);
  return results.filter(Boolean);
}

const main = async () => {
  const [_nodePath, _scriptPath, rootDir] = process.argv;

  // Find all the HTML templates in a given root directory (recursively)
  const files = await fs.readdir(rootDir, { recursive: true, withFileTypes: true });
  const htmlTemplates = files.filter(dirEnt => dirEnt.isFile() && dirEnt.name.includes('html'));

  htmlTemplates.forEach(template => {
    // Read the HTML file from disk 
    const filePath = path.resolve(template.parentPath, template.name);
    let contents = readFileSync(filePath, { encoding: "utf8" });

    // Parse the HTML into an AST
    const document = parse5.parse(contents);

    // Traverse the AST to collect relevant matches 
    const links = traverse(document);

    // Substitue matched links for new links in raw file contents (we could also alter the AST and re-print, but I don't care to fight with the additional complexity of EJS)
    links.forEach(link => {
      contents = contents.replace(link.value, ReplacementLinks[link.type]);
    })

    // writeFileSync with updated contents
    writeFileSync(filePath, contents);
  });

  console.log('processed', htmlTemplates.length);
}

main().then(_ => console.log('done')).catch(e => console.error(e));
