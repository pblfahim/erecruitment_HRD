/* CSV download + print helpers.
   No external libraries: Excel opens CSV natively and the browser's own
   print dialog produces the PDF from the styled document routes. */
(function (global) {
  'use strict';

  var ERec = global.ERec = global.ERec || {};
  var fmt = ERec.fmt;

  function toCSV(headers, rows) {
    var lines = [headers.map(fmt.csvCell).join(',')];
    rows.forEach(function (r) { lines.push(r.map(fmt.csvCell).join(',')); });
    return lines.join('\r\n');
  }

  /* BOM keeps Excel from mangling non-ASCII names. */
  function download(filename, text, mime) {
    var blob = new Blob(['﻿' + text], { type: (mime || 'text/csv') + ';charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  }

  function csv(filename, headers, rows) {
    download(filename, toCSV(headers, rows), 'text/csv');
    ERec.ui.toast(filename + ' downloaded');
  }

  /* Navigates to a print document route; print.js fires window.print(). */
  function printDoc(doc, id, extra) {
    var q = extra ? ('&' + extra) : '';
    global.location.href = 'print.html?doc=' + encodeURIComponent(doc) + '&id=' + encodeURIComponent(id) + q;
  }

  ERec.exp = { toCSV: toCSV, download: download, csv: csv, printDoc: printDoc };
})(window);
