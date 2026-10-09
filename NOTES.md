Possible issues and improvements:

1. The APP relies only on resolved tickers from the SIC API, so it does not support BRK.B ticker as it is presented as BRK-B there. This could be improved by implementing a mapping system that recognizes alternative ticker formats and resolves them correctly.
2. frontend does not support routing for certain pages, which can lead to a poor user experience.
3. Infra currently supports only development env. Production set up should be implemented.
4. Current test setup doesnt include logs.
5. The throttle is one global queue, so a big request blocks everyone.
