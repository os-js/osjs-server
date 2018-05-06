# Changelog for osjs-server

## 3.0.0-alpha.17

* Added npmignore
* Added CHANGELOG

## 3.0.0-alpha.16

* Broadcast package/meta updates in dev mode
* Solved an issue with session saving

## 3.0.0-alpha.15

* Added session customization, file as default
* Added broadcasting (ws) support
* Cleaned up HTTP VFS API, better error handling
* Updated some vfs handling
* Handle moutpoints properly, cleanups

## 3.0.0-alpha.14

* Updated application initialization
* Provide more user information on login
* Updated http session handling, require user id from login

## 3.0.0-alpha.13

* A more functional approach for Auth + Settings

## 3.0.0-alpha.11

* Updated provider loading
* Renamed server.js -> core.js
* Minor cleanup in VFS provider
* Create 'osjs/vfs' service
* Added basic Settings service provider, cleanups
* Pass on 'config' in Auth constructor
* Correct passing on args to Auth class
* Split default config + CoreBase update
* Now using '@osjs/common' module
* Added symbol to provider logging
* Updated default auth routes
* VFS now uses authenticated middleware
* Added 'osjs/express' provider
* Copy service provider instanciating from client
* Added provider options in registration
* Keep same Auth interface as in client
* Updated auth handler
* Removed a configuration option
* Added 'null' auth handler
* Added options argument in service provider
* Added support for passing on default provider options

## 3.0.0-alpha.10

* Added default 'home' mountpoint
* Added session support to segment parsing in vfs
* Sanitize paths given to VFS
* Update VFS configuration layout
* Added mounting of system directories
* Added config() to core
* Optimize readdir() in vfs
* Temporarily strip prefixes from inbound VFS call paths

## v3.0.0-alpha.9

* Added copy() VFS method
* Use 'fs-extra' instead of builtin 'fs'
* Clean up temporaries on upload in vfs
* Added multipart/upload to VFS req parsing, writefile() method
* Updated VFS methods and integration

## v3.0.0-alpha.8

* Changed app public path to '/apps/'

## v3.0.0-alpha.7

* Added engines dependendy to package.json
* Added esdoc config, updated docs
* Removed DefaultServiceProvider
* Pass on a 'proc' object instead of metadata in applications
* Added helpers to application init call

## v3.0.0-alpha.6

* Provide error code in scandir fail
* Corrected URLs in package.json

## v3.0.0-alpha.5

Initial public release
