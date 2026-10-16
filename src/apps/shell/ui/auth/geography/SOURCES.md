# Login map geometry

Source: IBGE, API de malhas geograficas v3, obtained 2026-10-16.

- Brazil with state boundaries: https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application%2Fvnd.geo%2Bjson&qualidade=minima&intrarregiao=UF
- Mangaratiba (3302601): https://servicodados.ibge.gov.br/api/v3/malhas/municipios/3302601?formato=application%2Fvnd.geo%2Bjson&qualidade=minima
- Documentation: https://servicodados.ibge.gov.br/api/docs/malhas?versao=3

`brazilMap.ts` contains projected, rounded SVG paths derived from the simplified GeoJSON meshes. The focus is the centroid of the largest municipal polygon, rather than a street address. Geometry is an illustrative overview, not a cadastral map. No IBGE or map tile request is made while signing in. Country and municipal boundaries use different simplification levels.
