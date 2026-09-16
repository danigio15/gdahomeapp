/* I vettori del QR code, presi da un'implementazione vera.
 *
 * **Questo file non si scrive a mano.** Lo rifa'
 * `strumenti/qr-riferimento.py`, che chiede a `qrcode` — la libreria Python
 * che sta dentro mezzo mondo — di disegnare gli stessi codici che disegna
 * `ponte/src/qr.js`, e ne segna l'impronta.
 *
 * Le impronte sono di tutte e nove le matrici di ogni prova: quella con la
 * maschera che l'encoder sceglie da solo, e tutte e otto quelle a maschera
 * fissa. Cosi' una prova rossa dice anche **dove** si e' rotto: se sbagliano
 * tutte e otto e' nei dati o nella correzione, se sbaglia solo la scelta e'
 * nel conto della bruttezza.
 *
 * Le lunghezze non sono a caso: quindici delle prove riempiono fino all'orlo
 * ognuna delle quindici versioni, e li' tutti i blocchi di correzione sono
 * pieni — e' dove le tabelle sbagliate vengono fuori.
 */

export const VETTORI = [
  {
    testo: "a",
    versione: 1,
    maschera: 5,
    impronte: [
      "e8ab680854e4019c", // scelta
      "ad65f877bf9411d1", // maschera 0
      "50b2ea55f7ddab9e", // maschera 1
      "65c3f1acd0d11214", // maschera 2
      "8503acd70f562cac", // maschera 3
      "ed92d118774a8ffc", // maschera 4
      "e8ab680854e4019c", // maschera 5
      "a8a0fd4aecd444f8", // maschera 6
      "5f34dc0326dd2454", // maschera 7
    ],
  },
  {
    testo: "gdahome",
    versione: 1,
    maschera: 2,
    impronte: [
      "41420d06afcba50f", // scelta
      "a8063b4b36041b3e", // maschera 0
      "52cbf24c733f9cda", // maschera 1
      "41420d06afcba50f", // maschera 2
      "7059f627821185e8", // maschera 3
      "0f10f36ec6c6c33f", // maschera 4
      "340de5ae9cb3bc3d", // maschera 5
      "c5112b3d0c746b13", // maschera 6
      "9def9b1289cb67cb", // maschera 7
    ],
  },
  {
    testo: "ciao, casa!",
    versione: 1,
    maschera: 0,
    impronte: [
      "69c985b8dee5cf3a", // scelta
      "69c985b8dee5cf3a", // maschera 0
      "c2dcd072f9ce49a0", // maschera 1
      "d22bb849bdc488d6", // maschera 2
      "edf260dc6731e716", // maschera 3
      "508db438dd1f3712", // maschera 4
      "c31670f3a957644c", // maschera 5
      "152ccb16fcb02e7f", // maschera 6
      "c035eedcf97375b2", // maschera 7
    ],
  },
  {
    testo: "gdahome://abbina?c=aQ3-kZ",
    versione: 2,
    maschera: 5,
    impronte: [
      "a8cc1e0161980add", // scelta
      "09d47b5dc0080947", // maschera 0
      "902bab357ba33dbf", // maschera 1
      "9ac6c74baeb160e5", // maschera 2
      "faaf5ade288c604c", // maschera 3
      "6b793e2b641f83ba", // maschera 4
      "a8cc1e0161980add", // maschera 5
      "765f35dc6a539aa1", // maschera 6
      "ffb4e6ede9ac17d7", // maschera 7
    ],
  },
  {
    testo: "Perche' l'accento e' un byte in piu': citta', pero', cosi'.",
    versione: 4,
    maschera: 5,
    impronte: [
      "619b53d2f0761c6d", // scelta
      "88abfff7af5baa6e", // maschera 0
      "a785af3d879314b3", // maschera 1
      "c215c1fa16412b61", // maschera 2
      "056a538c45c6cc31", // maschera 3
      "738377cb5495b15e", // maschera 4
      "619b53d2f0761c6d", // maschera 5
      "ea634e88b83de8f7", // maschera 6
      "3027b7490a7023b2", // maschera 7
    ],
  },
  {
    testo: "\u00e8\u00e9\u00ea\u00eb \u20ac \u2192 \ud83c\udfe0",
    versione: 2,
    maschera: 0,
    impronte: [
      "912f313273347f3a", // scelta
      "912f313273347f3a", // maschera 0
      "8f5ceec67b4b5884", // maschera 1
      "f5907a42469c9ef2", // maschera 2
      "1d9c669c779b1df1", // maschera 3
      "4414e12b60988ebb", // maschera 4
      "81b4bd44e2924e52", // maschera 5
      "88301bdb149918ca", // maschera 6
      "7d659b9935cad532", // maschera 7
    ],
  },
  {
    testo: "0123456789",
    versione: 1,
    maschera: 0,
    impronte: [
      "dcceac5fc5aaa1af", // scelta
      "dcceac5fc5aaa1af", // maschera 0
      "6762f26f5034b491", // maschera 1
      "86687c587edbc878", // maschera 2
      "350f556972d865a1", // maschera 3
      "a470fdbb571ae9ca", // maschera 4
      "1b9778d36d6f1df3", // maschera 5
      "5837159a85fdc403", // maschera 6
      "606c0dae34455788", // maschera 7
    ],
  },
  {
    testo: "HELLO WORLD",
    versione: 1,
    maschera: 4,
    impronte: [
      "2d21897bf5a7ac60", // scelta
      "2cee776cd87923a0", // maschera 0
      "c7636e44b12237cb", // maschera 1
      "4a00c00a60fcf7c1", // maschera 2
      "1e387bd8b7a170bf", // maschera 3
      "2d21897bf5a7ac60", // maschera 4
      "ab139df21b793714", // maschera 5
      "84a0007f0e8c0dba", // maschera 6
      "0903104ff7b59378", // maschera 7
    ],
  },
  {
    testo: "gSKfR44_geOgEs",
    versione: 1,
    maschera: 7,
    impronte: [
      "a0143d9e03099506", // scelta
      "5d3d10e3127ef3ad", // maschera 0
      "3acd528695cbb18e", // maschera 1
      "6da66090008bd66d", // maschera 2
      "900961544e6e3798", // maschera 3
      "543cb9263274faa4", // maschera 4
      "53a20b331f7307bd", // maschera 5
      "aa947fd84d3bc56b", // maschera 6
      "a0143d9e03099506", // maschera 7
    ],
  },
  {
    testo: "dik2htOlTt6WTHSmhr.dPIhn6D",
    versione: 2,
    maschera: 1,
    impronte: [
      "5245a7ec7dc32a31", // scelta
      "abceaba277b34596", // maschera 0
      "5245a7ec7dc32a31", // maschera 1
      "a63a4acde421a204", // maschera 2
      "34de4ce59e46c9fa", // maschera 3
      "c2ee18770704f82d", // maschera 4
      "496f670a9882b002", // maschera 5
      "03d3ee59c10dbfb2", // maschera 6
      "33ca2ab585c6d98c", // maschera 7
    ],
  },
  {
    testo: "BC5-zABUW6CS9vBZ_evHbjOHe34k4d7h6i.1Qeaj~c",
    versione: 3,
    maschera: 4,
    impronte: [
      "cb7449240128eb58", // scelta
      "b64ec793014eab5e", // maschera 0
      "26780001bf9ed06f", // maschera 1
      "5775a261cb0565b6", // maschera 2
      "ae319182f1aa3e3d", // maschera 3
      "cb7449240128eb58", // maschera 4
      "3f7f27a7daeef539", // maschera 5
      "51974844e66e57b0", // maschera 6
      "ca2cdbe5513ec1ae", // maschera 7
    ],
  },
  {
    testo: "DBBVoHs0_IqsjO~f~h~JPknYnlF-vBay5soKu~iUduEc5z2YypVm7UqvlmNV4V",
    versione: 4,
    maschera: 5,
    impronte: [
      "64dc8a71b49df2f1", // scelta
      "f29da792e2e95c75", // maschera 0
      "a4458c825b5a99ac", // maschera 1
      "47194a637bc06d3b", // maschera 2
      "c72037b6fa266601", // maschera 3
      "4b4afe055daef1db", // maschera 4
      "64dc8a71b49df2f1", // maschera 5
      "c49d26abbbf50237", // maschera 6
      "251053e1197fed1a", // maschera 7
    ],
  },
  {
    testo: "SVfA8AxNgCffLuyo1lM9ZnK08XHv-m.vfZfoK6v3vMTu_BlOCgyftCwkl8Cj-knbYCsWgcSy.6tv34-u.SS.",
    versione: 5,
    maschera: 7,
    impronte: [
      "de5307a29b07edbd", // scelta
      "cfbff3ab44f53104", // maschera 0
      "b2a6fb839d4a522c", // maschera 1
      "362658df913c30da", // maschera 2
      "077510a04f3e4854", // maschera 3
      "be662a887232db66", // maschera 4
      "de048b4bdff858a1", // maschera 5
      "36c5dd3228752559", // maschera 6
      "de5307a29b07edbd", // maschera 7
    ],
  },
  {
    testo:
      "Jn~NmcaONPTAwAwPv92OD.gw_UB0ymUCd58lOC66GJJFthQOdM7S6Ftf1P0uwMeuDaktBMZ55uYXEdk6zNcFuYr7tuiR3zyIFVBWO8OO7Y",
    versione: 6,
    maschera: 4,
    impronte: [
      "ae37d06abba206b7", // scelta
      "14e98911136e02e7", // maschera 0
      "ac4a5a7f86211bd6", // maschera 1
      "c2e715872a046a0c", // maschera 2
      "d795f17415204625", // maschera 3
      "ae37d06abba206b7", // maschera 4
      "e66554d3a292cc17", // maschera 5
      "e998e611db51c3e5", // maschera 6
      "245e9a6dafa031b7", // maschera 7
    ],
  },
  {
    testo:
      "G90nFFWg9D4JCzVOpsVBRBXlMaE6Tf55_cUJ2vgiKGh2lEhU0Dh_nwGKmx9w3as7C608K42Jki5tMtQsXYXFvqlAj2TCeyweuQKf-SLlE._2HOWw2Yw9rKRW6K",
    versione: 7,
    maschera: 2,
    impronte: [
      "8ef37502edf29127", // scelta
      "3614637ec3b1e2a7", // maschera 0
      "04035cebd1befba6", // maschera 1
      "8ef37502edf29127", // maschera 2
      "0d2bfa5b7b13c29a", // maschera 3
      "3dc4d5316029f9ff", // maschera 4
      "f51dce2d18d85577", // maschera 5
      "106eb9ccbf4edad0", // maschera 6
      "d4a9735ce43928ec", // maschera 7
    ],
  },
  {
    testo:
      "1Z--e3W1YntSdQ4Iz_1WVONZBoilUEDcCiJHXi_Udy.uTyR9NU.-NOS~wfP3usEbB6TLfuRazqBTBFcIX_pmQJYgTIiVTf.EcK4rqQ6r71qsxoTgB4jrKrS3CI1v3aopt-d0Zk7_J.f2RcoEAAD~RSS_",
    versione: 8,
    maschera: 7,
    impronte: [
      "95121b832e7393b1", // scelta
      "989f6e071e036469", // maschera 0
      "f2ea36a83c1530d6", // maschera 1
      "25f461daf9b78a53", // maschera 2
      "19a6889b5f577f4d", // maschera 3
      "ff518f8e5618938a", // maschera 4
      "cd4fb514dbde6ee3", // maschera 5
      "f84e151a75fa57a5", // maschera 6
      "95121b832e7393b1", // maschera 7
    ],
  },
  {
    testo:
      "lsqYG2l1B9ZA-jpLWbkq7qDfw3ka..hIu~UF4qsQ5qCjUuwjZjMWqc3lg7KBSFul3rPqY3e5GGAOTcgm9bumprXKfZNJEfj6sdFgI7tp7cVg_erue2e5IYh0CNqRqC~V.IXQmsDLmqYA58vPH2ouCbn.Ikg7RbAgXXSqfDlkZSrRqrfntDjC",
    versione: 9,
    maschera: 2,
    impronte: [
      "cdcc0d2ce82da97c", // scelta
      "638568c7a4d43240", // maschera 0
      "9fa023461f558158", // maschera 1
      "cdcc0d2ce82da97c", // maschera 2
      "41ec19a3a70e8275", // maschera 3
      "336070e42ab2a2cb", // maschera 4
      "3a2e3b9b6e3a8acf", // maschera 5
      "675bd8b4cfaef3a8", // maschera 6
      "821d3c34739a6832", // maschera 7
    ],
  },
  {
    testo:
      "L~i3FyiiS~EWoOIar3W_hKSp5TkBVQH3mor6afjE7pWKzk7BP__K52.HBeMx6a8-AH8PO5ntEv3Qna1oCZhwFaeCt4pQS-X5iAhYfqQh~nqbYLSzy0VC43Rm1Q4wNvbXVBT2S9PmX6i1sF5x.3NeMKwBGY8esM0P7P498wIGZHgS3_b5pq3YfEF5JwwDQwf6IjsV7jUeZdb4gW7HnLp7H",
    versione: 10,
    maschera: 7,
    impronte: [
      "ce41958f91743b97", // scelta
      "dffcd6c2e9aa1102", // maschera 0
      "45cc538ad772e8a3", // maschera 1
      "63abe647ff4c3be6", // maschera 2
      "2e3c9b4b58fbf205", // maschera 3
      "87f9e3ebaffa97af", // maschera 4
      "4a8f072dee10d12f", // maschera 5
      "d2566a84e997e48c", // maschera 6
      "ce41958f91743b97", // maschera 7
    ],
  },
  {
    testo:
      "S20DUTJYc5-qb4cAFlIOx-C-s1UglWhZahJgiHlo3zfDwCbMmoA~LfjH-3C21FTMfwKQSP-Ti9xO.JHkVThKDOfq.4Uqkwq3Sgk0MKDE2ncs~uZQel6MsvgfOD5FgjqRysESbyE8iP6~UL~eMfgJ.v3u-sYBTfjxCvt6NnIP.Pz.piC6W5muHxHAV8BxSD~lI0TFaOKBLmnfb0soxgkfr2cWRlIfUFgGmYDgUc6~BQgH~gQ5ly__GbP7iH1",
    versione: 11,
    maschera: 6,
    impronte: [
      "7a4c77b08ef3c03c", // scelta
      "81b025cb09113120", // maschera 0
      "a4a50ea19c83d234", // maschera 1
      "772e5376b4c73d88", // maschera 2
      "c603572804bed92a", // maschera 3
      "b2263b7ac6add4a2", // maschera 4
      "d8a88e14d8e59b9a", // maschera 5
      "7a4c77b08ef3c03c", // maschera 6
      "262b132bd88dc56c", // maschera 7
    ],
  },
  {
    testo:
      "FsazMwB_-FU-DEvnNkW4Nt.iZib7yPd8uExqVFrAsG.yOzHycTCa3E1q3RUNvjkiKaTobwhASGy.iNjJ0t57XRgZtq_vLxYG0Usq4pEjEIbj7QUfxDoFsy_awu2zfEtPRspx~sI.2Z74JwcOKggDfUkqbE~vTTIbSXVZxWLidYPg5v~ByCO-0.doHpCX5mMXTpm3.yQCyIqwiI1gvu1ieA40FY03bljfG06V1wSfVP~c~AOcvvqxXqCzMqqhXjIAP01Am76PcWmyzkt.vt-17cKSPzgy4YF",
    versione: 12,
    maschera: 5,
    impronte: [
      "5305861fb190a17c", // scelta
      "7df0e973a3c99c8f", // maschera 0
      "f99ec78e1bfdf0d0", // maschera 1
      "88fcdb96072321ae", // maschera 2
      "9d57d22a46878392", // maschera 3
      "99823aaa8575130c", // maschera 4
      "5305861fb190a17c", // maschera 5
      "e0c8470879abc32e", // maschera 6
      "39658489a651fd65", // maschera 7
    ],
  },
  {
    testo:
      "N0PtEf09B~nUn0XbjFiFRbR9-YnQ-Th-hjRs4qWPJEmFUjDQoIz~vMJVvgAgDGAZ94XoWSa05qbXaOUMJ8Q5rJg7pn1hY__IWMR~cBk1y2s7aNA91tag8TVlxrVavn.D7B30SwVPisWT5l~lJ8EADRPreZRXJVAmBaB9X1zhlVDx1mefJmFHwP9GNy0OAf-0TUifHtKRLNoQHv_e_znv0oDo3Ek~sIoFPZY~OHlQSYQUcKZSqk.TcWA9emYsMi8S.49D8g4vcKOFlidIsk-BZ4_oLv.su5DIz39dvH7EONlTwk~nqP_6Cabwo2tle6GqORreBva-e48",
    versione: 13,
    maschera: 3,
    impronte: [
      "911f9d7e0f1a92bb", // scelta
      "466cc4ceae8d45cc", // maschera 0
      "655d76f8a3e6a2c5", // maschera 1
      "c8aeab4384c46e87", // maschera 2
      "911f9d7e0f1a92bb", // maschera 3
      "5971894ff545e26b", // maschera 4
      "eefcb27d1617db7f", // maschera 5
      "6be9e97a6dd8b0ab", // maschera 6
      "1f38d2ac6fdcbe4e", // maschera 7
    ],
  },
  {
    testo:
      "JVb--sKL~WT.QCJH.A.FSv9_UABzLl7Zz0~~nl9LhkNqG0yzuyxYctqpr914C31RrA4O.Ut_1vVVrr21YD1Vw2v9GSvAdLGxzKIsSFRs~JqTFjZeuJiz03Q6tiHiN38QhBUna0QTZX0yIrr-6~eqSgo04to_DI_1~6ORMCCXac7rdlN.PwgG5zOX35I.xO6RS3_xWap_mOe6-ropPMr6s2u8PqKcha-NP7.F9Ws9pvmio_0o7Z7tCZ7FEaZM2GcPmh9diA7Q.zCS.A6trfd8RXgqEG6lPLnrgcjpZN~352k.2R9hcwRvhIR.qmwI_SaCpDTh3CHfdthUvtwU5idkBPk_0cwy8Ernbam2kNQgXL",
    versione: 14,
    maschera: 2,
    impronte: [
      "ec283ec2a6f2e649", // scelta
      "52c25fed22856c14", // maschera 0
      "d24ec9e6eb60ca00", // maschera 1
      "ec283ec2a6f2e649", // maschera 2
      "d48bae0101c73f89", // maschera 3
      "e1764692da7ea772", // maschera 4
      "23d3b68927a8beda", // maschera 5
      "2850b5d8e5e66273", // maschera 6
      "fc557b8ff0936d12", // maschera 7
    ],
  },
  {
    testo:
      "QjrvHQAmUV3ZT-97jFMmWeKtc5O1.-9.gK.9DDE2_drk3ab8UwTKcvpBi5gAbtBKd-WHcYjRxsqz9u0r8GH_m0u6xsUGopWNfsWebEXAXAEyUvYRz_iQC3aFk7wyfYGDcvL2TlVBeKq6c8n-vsr6oLKbEsnThTWpumwzx.xddnDwP4n1Y0-fX7TzG-.MyZxdXrIzNf~mdiVEQWK.rWip9DBhlK_jT7qlK9_QOFReLExfjIg~m6CwMr2PYvw4fL84cZk.6y0YmtqgKFyeGBrtfQqHQMiGx.tZMe812B.pB_c5EZY-L_bxOGgiVAq~dkIIlX_ALkED_S6uxyjGiV4eXGHTBdLJME3ukBDBLQymRRCkU0kKxf2vNP3uHcbhl2UKZW_8Y~Ltx6pR4Req8BZQMtB9dNm~",
    versione: 15,
    maschera: 5,
    impronte: [
      "78596b687ef20176", // scelta
      "3a23b280699dc730", // maschera 0
      "a81530c7580ed9a3", // maschera 1
      "2df4e2767fd646c6", // maschera 2
      "905259d43dec5486", // maschera 3
      "8142efa8a85c43f1", // maschera 4
      "78596b687ef20176", // maschera 5
      "fde920709f8cc52e", // maschera 6
      "61022bd055e04dca", // maschera 7
    ],
  },
];

/* Due matrici per intero, in chiaro.
 *
 * Le impronte dicono «e' cambiato qualcosa» e non dicono altro. Questi due
 * disegni si guardano a occhio: se un giorno una prova diventa rossa, un
 * mirino storto o un righello che manca si vede da qui in tre secondi.
 */

export const IL_DISEGNO_PICCOLO = {
  testo: "gdahome",
  disegno: [
    "#######..#.#..#######",
    "#.....#..###..#.....#",
    "#.###.#.#...#.#.###.#",
    "#.###.#.#.#.#.#.###.#",
    "#.###.#.##..#.#.###.#",
    "#.....#.#..#..#.....#",
    "#######.#.#.#.#######",
    "........###..........",
    "#.#####...##..#####..",
    "#..##....#######.##.#",
    "###...##....#.##..##.",
    "#...#..########..####",
    "#..#.####.#.#......#.",
    "........##..#..##.#.#",
    "#######..#.#.#...###.",
    "#.....#.##.......####",
    "#.###.#.#.##.#..#..#.",
    "#.###.#.#.#######....",
    "#.###.#.###.#.#...#..",
    "#.....#..#.####.###..",
    "#######.###.#...#..#.",
  ].join("\n"),
};

export const IL_DISEGNO_CON_LA_VERSIONE = {
  testo:
    "XtYpmf2HEgLweuvT4JpTjLKuMIin8Isc7e0br.81yWRmRrioGSDcK5CGJW74D4dK.8Qu-u-ILI~kPAwfM4wyAuxs49C6mKvyokB.UIXL_~Jrr.LWFU2RIS8zuc",
  disegno: [
    "#######.##.#.#.#.#...#..#....###.#..#.#######",
    "#.....#.##.#.##.####.##..#.##.####.#..#.....#",
    "#.###.#...#......#...###....#..#...#..#.###.#",
    "#.###.#.#.#...#.######.####....#...##.#.###.#",
    "#.###.#..#.##.#..#..#########.....###.#.###.#",
    "#.....#..###.#..##.##...##..###.#.....#.....#",
    "#######.#.#.#.#.#.#.#.#.#.#.#.#.#.#.#.#######",
    "........###.##.#....#...####.##..#...........",
    "#.##.###.###.....#..######.####..##.#.#..#.##",
    "..##.#....####..#..##...##.#.##.#...##....###",
    "#....####..##..#.###.#.........#..#....##.###",
    "###.#.....#######....##.#..##.#...##.#.....#.",
    "#..##.##....##.#.##.#.#.#......#...#..#..#..#",
    ".#.###.###.##...##....#.###....###.#.####...#",
    ".#.#..#.###.#...##..####.###.##.##....##.....",
    ".#.....#....###...#....###.#.####.#......###.",
    "..##.#####.####.#...##.#..##.#####.#.###.#.#.",
    "..##...##.##.#..#....#.......#...###....#.###",
    "####.##....###.##.###..####..###.#..######.#.",
    "##.#...#....#..##.#.##...###.#.#..###...#...#",
    "...######..##...#...#########.#..##########..",
    "..#.#...#.#####..#.##...##..#####...#...###.#",
    "##.##.#.##...#####.##.#.####.###.#..#.#.##.##",
    "#.#.#...#.##.##..####...####....###.#...##..#",
    "..#######.###.###.#.#####.#...##..#.#######..",
    "###.#..######..#.#.#.....##.#..###..##.#...##",
    "###...###.##.##.##########.....##.###...###..",
    "...###.#..###.#..#....###..#..#.####...#.##.#",
    ".....######.#...#..#.#..##.#.#####.####.###..",
    ".#.#...##..#.#.#.##.#.#.#....#.####.#####.###",
    "#..##.##.###.#...#...####...##.....#...#.#.#.",
    ".#.....#..#.#...#.#.#....##.#.....#..#...#...",
    "#..#..###...##.##.#.###.#.###....##..#....#..",
    "..####.##.....#..###..#.##..#.###..#..#..####",
    "....#.#.#....##...#....#.#.#..###.....##.##.#",
    ".####...#...#.#.###..#.#....#.#.....###..#.#.",
    "#..##.#.###..#..#...######...###.#..######.#.",
    "........##..#..#.#.##...#.###...##.##...####.",
    "#######.###...###.###.#.#.##..#.#.###.#.##...",
    "#.....#.#..#.#.#.####...####..#...#.#...####.",
    "#.###.#....#...#.##.#####.##...##..######.#..",
    "#.###.#.#.#.#.#.#####.##....##.#.##.#..#.#..#",
    "#.###.#.#.####.#..#.#.#......#.##.#.##.#.###.",
    "#.....#....#.....##...#.#...##.###.##.#.##..#",
    "#######.##..#.#.#....##...#.#.#..#...###.##..",
  ].join("\n"),
};
