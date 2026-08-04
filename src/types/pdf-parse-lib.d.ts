// pdf-parse@1.x tem um bug conhecido: o seu ficheiro de entrada
// (index.js) corre código de debug (tenta ler um PDF de teste que
// não existe) quando é importado num contexto ESM/bundler como o
// Next.js — ver https://github.com/modesty/pdf2json ou issues do
// pdf-parse sobre "ENOENT ./test/data/05-versions-space.pdf".
//
// A correção é importar o ficheiro interno da lib diretamente,
// saltando esse código de debug. Este shim dá-lhe o mesmo tipo do
// pacote principal.
declare module 'pdf-parse/lib/pdf-parse.js' {
  import PdfParse from 'pdf-parse'
  export default PdfParse
}
