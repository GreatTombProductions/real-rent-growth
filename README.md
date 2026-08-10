# Real Rent Growth

How much have rents actually risen in your county? Median gross rent (Census ACS 5-year, table B25064) for every US county across three windows (2010–14, 2015–19, 2019–23), with growth reported both nominal and CPI-adjusted. Built from public data; free, static, no signup.

## Data Sources
- US Census Bureau ACS 5-Year Summary Files — https://www.census.gov/programs-surveys/acs
- BLS CPI-U (CPIAUCSL) via FRED — https://fred.stlouisfed.org/series/CPIAUCSL

## How to rebuild
```bash
cd pipeline
python3 generate.py   # fetches ACS summary files (remote range reads) + CPI, emits ../frontend/data/
cd ..
./deploy.sh           # push static snapshot to gh-pages
```

MIT License.
